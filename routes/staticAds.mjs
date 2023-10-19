import express from "express";
import db from "../db/conn.mjs";
import { ObjectId } from "mongodb";
import { Storage } from "@google-cloud/storage";
import multer from "multer";

const storage = new Storage({
  projectId: "bustling-surf-398905",
  keyFilename: "bustling-surf-398905-cd0a4fd7ec7c.json",
});
const bucket = storage.bucket("tamc_advertisements");
//GET FILES
const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    let collection = db.collection("staticAds");
    let results = await collection
      .find({ status: { $not: { $eq: "deleted" } } })
      .toArray();
    let [files] = await bucket.getFiles();
    const items = [];

    files = files.filter((file) => file.name.startsWith("staticAds"));

    files.forEach((file) => {
      if (file.metadata.contentType === "text/plain") return;
      items.push({
        _id: file.metadata.metadata.dbID,
        _urlID: file.id,
        fileName: file.name,
        timeCreated: file.metadata.timeCreated,
        timeUpdated: file.metadata.updated,
      });
    });
    const library = results.map((result) => {
      const match = items.find((item) => item._id == result._id);
      if (match) {
        return { ...result, ...match };
      }
      return result; // If no match is found, use the result from MongoDB
    });

    results
      .filter((result) => !items.find((item) => item._id == result._id))
      .forEach((unmatchedResult) => {
        library.push(unmatchedResult);
      });

    res.send(library).status(200);
  } catch (error) {
    console.error("Error listing bucket contents:", error);
    res.status(500).send(error);
  }
});

router.post("/create", upload.single("file"), async (req, res) => {
  try {
    const image = req.file;
    const data = JSON.parse(req.body.adData);
    let collection = db.collection("staticAds");
    let result = await collection.insertOne(data);
    if (!image || image.length === 0) {
      return res.status(400).send("No image uploaded.");
    }

    image.originalname = "staticAds/" + image.originalname;
    const fileUpload = bucket.file(image.originalname);
    const stream = fileUpload.createWriteStream({
      metadata: {
        contentType: image.mimetype,
        metadata: {
          dbID: result.insertedId,
        },
      },
    });
    stream.on("error", (error) => {
      res.status(400).send(error);
      console.error(`Error uploading ${image.originalname}:`, error);
    });
    // Upload the file
    stream.end(image.buffer);
    await new Promise((resolve) => stream.on("finish", resolve));

    res.status(200).send("Created new static ad");
  } catch (error) {
    console.error("Error uploading: ", error);
    res.status(500).send(error);
  }
});
router.patch("/:id", upload.single("file"), async (req, res) => {
  try {
    const adData = JSON.parse(req.body.adData);
    const image = req.file;
    let collection = db.collection("staticAds");
    const query = { _id: new ObjectId(req.params.id) };
    const updates = {
      $set: {
        name: adData.name,
        description: adData.description,
        category: adData.category,
        link: adData.link,
      },
    };
    let result = await collection.updateOne(query, updates);

    if (result.acknowledged) {
      if (image) {
        image.originalname = "staticAds/" + image.originalname;
        await bucket.file(adData.imagePath).delete();
        const fileUpload = bucket.file(image.originalname);
        const stream = fileUpload.createWriteStream({
          metadata: {
            contentType: image.mimetype,
            metadata: {
              dbID: adData._id,
            },
          },
        });
        stream.on("error", (error) => {
          res.status(400).send(error);
          console.error(`Error uploading ${image.originalname}:`, error);
        });
        // Upload the file
        stream.end(image.buffer);
        await new Promise((resolve) => stream.on("finish", resolve));
        res
          .send({
            acknowledged: true,
            modified: "full",
          })
          .status(200);
      } else {
        res
          .send({
            acknowledged: true,
            modified: "partial",
          })
          .status(200);
      }
    } else {
      console.log("error in database");
    }
    // res.send({ data: adData, file: image }).status(200);
  } catch (error) {
    console.error("Error uploading: ", error);
    res.status(500).send(error);
  }
});
router.delete("/:id", async (req, res) => {
  const collection = db.collection("staticAds");
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
