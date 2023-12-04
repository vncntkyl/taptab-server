import express from "express";
import db from "../db/conn.mjs";
import { ObjectId } from "mongodb";

const router = express.Router();
let collection = db.collection("players");

router.get("/", async (req, res) => {
  try {
    let query = {
      status: { $not: { $eq: "deleted" } },
    };
    let results = await collection.find(query).toArray();
    res.send(results).status(200);
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
});
router.get("/taptab/:id", async (req, res) => {
  try {
    let query = {
      status: { $not: { $eq: "deleted" } },
    };
    const result = await collection.findOne({
      _id: new ObjectId(req.params.id),
    });
    res.send(result).status(200);
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
});

router.post("/", async (req, res) => {
  const data = req.body;

  let result = await collection.insertOne(data);
  res.send(result).status(204);
});

router.post("/login", async (req, res) => {
  const data = req.body;

  try {
    const result = await collection.findOne({ access_code: data.key });

    if (result) {
      if (result.status === "ready") {
        const response = await collection.updateOne(
          { _id: new ObjectId(result._id) },
          { $set: { status: "connected", isOnline: true, deviceIP: data.ip } }
        );
        if (response.acknowledged) {
          const playerData = await collection.findOne({
            _id: new ObjectId(result._id),
          });
          res.status(200).send(playerData);
        }
      } else {
        res.status(200).send("The code you have entered is already used.");
      }
    } else {
      res.status(200).send("Access code not found.");
    }
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).send("Server Error");
  }
});
router.get("/get-ip", async (req, res) => {
  const ipAddress = req.ip || req.socket.remoteAddress;
  res.send(ipAddress);
});
router.patch("/:id", async (req, res) => {
  const query = { _id: new ObjectId(req.params.id) };
  const data = req.body;
  delete data._id;
  const updates = {
    $set: { ...data },
  };
  let result = await collection.updateOne(query, updates);
  res.send(result).status(204);
});

router.delete("/:id", async (req, res) => {
  const query = { _id: new ObjectId(req.params.id) };

  const updates = {
    $set: {
      status: "deleted",
    },
  };
  let result = await collection.updateOne(query, updates);

  res.send(result).status(200);
});

router.post("/log/:id", async (req, res) => {
  const query = { _id: new ObjectId(req.params.id) };
  const data = req.body;
  delete data._id;
  const updates = {
    $set: {
      last_location: {
        long: data.long,
        lat: data.lat,
      },
    },
  };
  let result = await collection.updateOne(query, updates);
  res.send(result).status(204);
});

router.get("/ping", async (req, res) => {
  const uniqueID = new ObjectId();

  res.status(200).send({ _id: uniqueID });
});
router.post("/ping/:id", async (req, res) => {
  const uniqueID = req.params.id;
  const tabData = req.body; // Use query parameter to get tabData

  if (uniqueID) {
    res.send(tabData).status(200);
  } else {
    console.log("disconnected");
  }
});

export default router;
