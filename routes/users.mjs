import express from "express";
import db from "../db/conn.mjs";
import { ObjectId } from "mongodb";
import md5 from "md5";

const router = express.Router();

//GET USERS
router.get("/", async (req, res) => {
  try {
    let collection = db.collection("users");
    let query = {
      status: { $not: { $eq: "deleted" } },
    };
    let results = await collection
      .find(query)
      .project({
        password: 0,
      })
      .toArray();
    res.send(results).status(200);
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
});

// REGISTER USER
router.post("/register", async (req, res) => {
  try {
    const loginData = req.body;
    const newUser = {
      username: loginData.last_name.split(" ").join("").toLowerCase(),
      password: md5(loginData.last_name.split(" ").join("").toLowerCase()),
      first_name: loginData.first_name,
      middle_name: loginData.middle_name || "",
      last_name: loginData.last_name,
      position: loginData.position,
      role: loginData.role,
      email_address: loginData.email_address,
    };
    let collection = db.collection("users");
    let result = await collection.findOne({ username: newUser.username });
    if (!result) {
      result = await collection.insertOne(newUser);
      res.send(result).status(204);
    } else {
      res.send("Already registered").status(404);
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
});
// LOGIN USER
router.post("/login", async (req, res) => {
  try {
    const loginData = req.body;
    let collection = db.collection("users");
    let query = {
      username: loginData.username.toLowerCase(),
      password: md5(loginData.password),
    };
    let result = await collection.findOne(query);
    if (!result) {
      res.send("Incorrect username or password").status(404);
    } else {
      if (result.status === "deleted") {
        res
          .send(
            "Sorry your account has been terminated. Please contact your administrator for your account's recovery."
          )
          .status(404);
      } else if (result.status === "inactive") {
        res
          .send(
            "Sorry your account has been deactivated. Please contact your administrator for your account's reactivation."
          )
          .status(404);
      } else {
        res.send(result).status(200);
      }
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
});
//UPDATE USER
router.patch("/:id", async (req, res) => {
  const userData = req.body;
  let collection = db.collection("users");
  const query = { _id: new ObjectId(req.params.id) };
  const updates = {
    $set: {
      username: userData.username,
      first_name: userData.first_name,
      middle_name: userData.middle_name || "",
      last_name: userData.last_name,
      position: userData.position,
      role: userData.role,
      email_address: userData.email_address,
    },
  };
  let result = await collection.updateOne(query, updates);

  res.send(result).status(200);
});
//REACTIVATE USER
router.patch("/reactivate/:id", async (req, res) => {
  const collection = db.collection("users");
  const query = { _id: new ObjectId(req.params.id) };

  const updates = {
    $set: {
      status: "active",
    },
  };
  let result = await collection.updateOne(query, updates);

  res.send(result).status(200);
});
//DEACTIVATE USER
router.delete("/deactivate/:id", async (req, res) => {
  const collection = db.collection("users");
  const query = { _id: new ObjectId(req.params.id) };

  const updates = {
    $set: {
      status: "inactive",
    },
  };
  let result = await collection.updateOne(query, updates);

  res.send(result).status(200);
});
//DELETE USER
router.delete("/delete/:id", async (req, res) => {
  const collection = db.collection("users");
  const query = { _id: new ObjectId(req.params.id) };

  const updates = {
    $set: {
      status: "deleted",
    },
  };
  let result = await collection.updateOne(query, updates);

  res.send(result).status(200);
});

export default router;
