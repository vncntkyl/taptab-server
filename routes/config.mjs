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
function updateNested(obj, path, newValue) {
  if (!path) return obj;

  const keys = path.split(".");
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }

  current[keys[keys.length - 1]] = newValue;

  return obj;
}

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
router.patch("/", async (req, res) => {
  const updatedjson = req.body;

  let settings = await new Promise((resolve, reject) => {
    retrieveFile((err, jsonData) => {
      if (err) {
        reject(err);
      } else {
        resolve(jsonData);
      }
    });
  });

  // Apply updates
  for (const [key, value] of Object.entries(updatedjson)) {
    settings = updateNested(settings, key, value);
  }

  const updatedConfig = settings;
  updateFile(updatedConfig, (err) => {
    if (err) {
      res.status(500).send("Error updating JSON file");
      return;
    }
    res.send(updatedConfig).status(200);
  });
});

export default router;
