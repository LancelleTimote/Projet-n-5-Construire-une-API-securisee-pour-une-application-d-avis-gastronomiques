//on retrouve ici la logique métier en lien avec nos utilisateurs, appliqué aux routes POST pour les opérations d'inscription et de connexion

const bcrypt = require('bcrypt');       //on utilise l'algorithme bcrypt pour hasher le mot de passe des utilisateurs
const jwt = require('jsonwebtoken');    //on utilise le package jsonwebtoken pour attribuer un token à un utilisateur au moment ou il se connecte
const User = require('../models/User'); //on récupère notre model User, créée avec le schéma mongoose
const CryptoJS = require('crypto-js');  //on utilise le package cryptojs pour hash l'email
require('dotenv').config();

//CryptoJS cryptage email
const key = CryptoJS.enc.Utf8.parse(process.env.emailSecretKey);
const iv = CryptoJS.enc.Utf8.parse(process.env.otherEmailSecretKey);

function encryptEmail(string) {
    const enc = CryptoJS.AES.encrypt(string, key, { iv: iv });
    return enc;
}

exports.signup = (req, res, next) => {  //on sauvegarde un nouvel utilisateur et crypte son mot de passe avec un hash généré par bcrypt
    bcrypt.hash(req.body.password, 10)  //on appelle la méthode hash de bcrypt et on lui passe le mdp de l'utilisateur, le salte (10) ce sera le nombre de tours qu'on fait faire à l'algorithme
    .then(hash => {                     //on récupère le hash de mdp qu'on va enregister en tant que nouvel utilisateur dans la BBD MongoDB
        const user = new User({         //on crée le nouvel utilisateur avec notre modèle mongoose
            email: encryptEmail(req.body.email),               //le mail crypté
            password : hash             //on récupère le mdp hashé de bcrypt
        });
        user.save()                     //on utilise la méthode save de notre user pour l'enregistrer dans la bdd
        .then(() => res.status(201).json({ message: 'Your account has been registered !' }))
        .catch(error => res.status(400).json({ error }));    //s'il existe déjà un utilisateur avec cette adresse email
    })
    .catch(error => res.status(500).json({ error }));
};

exports.login = (req, res, next) => {       //permet aux utilisateurs de se connecter avec des utilisateurs existants
    User.findOne({email: encryptEmail(req.body.email).toString()}) //user.findOne pour trouver un seul utilisateur de la bdd, puisque mail unique, on veut que se soit l'utilisateur pour qui le mail
    .then(user => {
        if (!user) {                        //on vérifie ici si on a récupéré un user ou non, si pas de user
            return res.status(401).json({ error: "User not found !" });  //on renvoie un 401 non autorisé, avec comme erreur Utilisateur non trouvé
        }
        bcrypt.compare(req.body.password, user.password)    //on utilise bcrypt pour comparer les hashs et savoir si ils ont la même string d'origine
        .then(valid => {
            if (!valid) {   //si la comparaison n'est pas valable
                return res.status(401).json({ error: 'Incorrect password !' }); //on retourne un 401 non autorisé, avec une erreur mdp incorrect
            }
            res.status(200).json({  //si la comparaison est valable, on renvoie un statut, 200 pour une requête ok, on renvoie un objet JSON avec un userID + un token
                userId: user._id,
                //permet de vérifier si la requête est authentifiée
                //on va pouvoir obtenir un token encodé pour cette authentification grâce à jsonwebtoken, on va créer des tokens et les vérifier
                token: jwt.sign(                //encode un nouveau token avec une chaine de développement temporaire
                    { userId: user._id },       //encodage de l'userdID nécéssaire dans le cas où une requête transmettrait un userId (ex: modification d'une sauce)
                    process.env.tokenSecretKey, //clé d'encodage du token
                    { expiresIn: '24h' }        //argument de configuration avec une expiration au bout de 24h
                )
            });
        })
        .catch(error => res.status(500).json({ error }));
    })
    .catch(error => res.status(500).json({ error }));
};