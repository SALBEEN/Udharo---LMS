# 🛠️ Udharo — Equipment & Spare Parts Rental Platform

> A robust, role-based RESTful API powering seamless lending and renting of spare parts and equipment. Built with Node.js, Express, MongoDB, and Firebase Authentication.

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green?logo=nodedotjs)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-v5.0-blue?logo=express)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-green?logo=mongodb)](https://www.mongodb.com/)
[![Firebase](https://img.shields.io/badge/Firebase-Phone%20Auth-orange?logo=firebase)](https://firebase.google.com/)
[![License](https://img.shields.io/badge/License-ISC-lightgrey.svg)](LICENSE)

---

## ✨ Features

- **Role-Based User Architecture:** Conditional data requirements for **Lenders** (Store Address) vs. **Renters** (Personal Address/Verification).
- **Secure Phone Verification:** Integrates with Firebase Admin SDK for OTP verification.
- **Stateless Sessions:** Managed via JSON Web Tokens (JWT) paired with salted `bcrypt` password hashing.
- **Input Validation:** Middleware-level sanitization and validation for conditional payload formats.
- **Modular Architecture:** Express configuration (`app.js`), database bootstrap (`server.js`), dedicated routers, and isolated controllers.

---

## 🛠️ Tech Stack

| Category                | Technology                                            |
| :---------------------- | :---------------------------------------------------- |
| **Runtime Environment** | Node.js                                               |
| **Framework**           | Express.js                                            |
| **Database**            | MongoDB with Mongoose ODM                             |
| **Authentication**      | Firebase Admin SDK (Phone OTP), JSON Web Tokens (JWT) |
| **Security**            | Bcrypt (Password Hashing), Dotenv                     |

---

## 📁 Project Structure

```text
backend/
├── src/
│   ├── Config/          # Database & Firebase Admin configurations
│   ├── Controllers/     # Request handlers & core business logic
│   ├── Models/          # Mongoose schemas & data models
│   └── Routes/          # Express API endpoint definitions
├── .env.example         # Environment variables template
├── .gitignore            # Excluded files (node_modules, .env, service keys)
├── app.js               # Express application configuration & middleware
├── server.js            # Entry point: Server initialization & MongoDB connection
└── package.json         # Dependencies and lifecycle scripts
```
