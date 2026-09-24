const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/login', authController.login);
router.get('/users', authController.obtenerUsuarios);
router.get('/usuarios', authController.obtenerUsuarios);
router.post('/register', authController.registrarUsuario);
router.post('/users/edit', authController.editarUsuario);
router.post('/edit', authController.editarUsuario);

module.exports = router;
