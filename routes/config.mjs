import express, { json } from "express";
import fs from "fs";

const router = express.Router();

const filePath = "taptab.config.json";
const retrieveFile = (callback) => {
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      console.error(err);
      callback(err, null);
      return;
    }
    const json = JSON.parse(data);
    callback(null, json);
  });
};
const updateFile = (updatedData, callback) => {
  const updatedJsonString = JSON.stringify(updatedData, null, 2);

  fs.writeFile(filePath, updatedJsonString, "utf8", (err) => {
    if (err) {
      console.error(err);
      callback(err);
      return;
    }
    console.log("JSON file has been updated!");
    callback(null);
  });
};

router.get("/", async (req, res) => {
  retrieveFile((err, jsonData) => {
    if (err) {
      res.status(500).send("Error reading JSON file");
      return;
    }
    res.send(jsonData).status(200);
  });
});

// UPDATE AN ITEM
router.put("/", async (req, res) => {
  const updatedjson = req.body;
  updateFile(updatedjson, (err) => {
    if (err) {
      res.status(500).send("Error updating JSON file");
      return;
    }
    res.send(updatedjson).status(200);
  });
});

export default router;
