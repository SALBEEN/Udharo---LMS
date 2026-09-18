import express from "express";

const app = express();

app.use(express.json());

app.defaultConfiguration();

// implement the cors and other necessary attributes and methods there

// initialize the multer so that the app can works with image files

// setup all route and internal api

//export the app and the server will import it

export default app;
