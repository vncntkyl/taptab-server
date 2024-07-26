import express from "express";
import db from "../db/conn.mjs";
import { ObjectId } from "mongodb";
import { Storage } from "@google-cloud/storage";
import multer from "multer";
import { format } from "date-fns";

const storage = new Storage({
  projectId: "taptab-418401",
  keyFilename: "taptab-418401-a7f87dfe0929.json",
});
const bucket = storage.bucket("tap_ads");
//GET FILES
const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    let collection = db.collection("staticAds");
    let results = await collection
      .aggregate([
        {
          $match: {
            status: {
              $not: {
                $eq: "deleted",
              },
            },
          },
        },
        {
          $lookup: {
            from: "staticAnalytics",
            localField: "_id",
            foreignField: "_id",
            as: "views",
          },
        },
        {
          $unwind: {
            path: "$views",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            "views._id": 0,
          },
        },
      ])
      .toArray();
    let bucket = storage.bucket("tap_ads");
    let [files] = await bucket.getFiles();
    const items = [];

    files = files.filter((file) => file.name.startsWith("staticAds"));

    for (const file of files) {
      if (file.metadata.contentType === "text/plain") return;
      const options = {
        version: "v4",
        action: "read",
        expires: Date.now() + 60 * 60 * 1000,
      };
      const [signedUrl] = await bucket.file(file.name).getSignedUrl(options);

      items.push({
        _id: file.metadata.metadata.dbID,
        type: file.metadata.metadata.type,
        timeCreated: file.metadata.timeCreated,
        timeUpdated: file.metadata.updated,
        signedUrl: signedUrl,
      });
    }

    const library = results.map((result) => {
      const match = items.filter((item) => item._id == result._id);
      if (match) {
        return {
          ...result,
          timeCreated: match[0].timeCreated,
          timeUpdated: match[0].timeUpdated,
          images: [
            ...match.map((item) => ({
              signedUrl: item.signedUrl,
              type: item.type,
            })),
          ],
        };
      }
      return result;
    });

    res.send(library).status(200);
  } catch (error) {
    console.error("Error listing bucket contents:", error);
    res.status(500).send(error);
  }
});

router.get("/analytics", async (req, res) => {
  try {
    const collection = db.collection("staticAnalytics");
    const currentDate = new Date();
    const startDate = new Date(
      new Date().setDate(currentDate.getDate() - 28)
    ).toISOString();
    const response = await collection
      .find({
        "logs.date": {
          $gte: startDate,
          $lte: currentDate.toISOString(),
        },
      })
      .toArray();

    let analytics = [];
    let count = 0;
    if (response) {
      count = response.length;
      response.forEach(({ logs }) => {
        analytics.push(...logs);
      });
    }
    let information = [
      {
        name: "Impressions",
        value: 0,
      },
      {
        name: "Engagements",
        value: 0,
      },
    ];
    for (const entry of analytics) {
      if (entry.action === "viewed") {
        information[0].value += 1;
      }
      if (entry.action === "scanned") {
        information[1].value += 1;
      }
    }
    res.status(200).send(information);
  } catch (error) {
    console.error("Error listing bucket contents:", error);
    res.status(500).send(error);
  }
});
router.get("/:id", async (req, res) => {
  try {
    let collection = db.collection("staticAds");
    let results = await collection
      .aggregate([
        {
          $match: {
            status: {
              $not: {
                $eq: "deleted",
              },
            },
            _id: new ObjectId(req.params.id),
          },
        },
        {
          $lookup: {
            from: "staticAnalytics",
            localField: "_id",
            foreignField: "_id",
            as: "views",
          },
        },
        {
          $unwind: {
            path: "$views",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            "views._id": 0,
          },
        },
      ])
      .toArray();

    let bucket = storage.bucket("tap_ads");
    let [files] = await bucket.getFiles();
    const items = [];

    files = files.filter((file) => {
      const isStaticAds = file.name.startsWith("staticAds");

      const hasID = file.metadata.metadata
        ? file.metadata.metadata.dbID === req.params.id
        : null;

      return isStaticAds && hasID;
    });

    for (const file of files) {
      if (file.metadata.contentType === "text/plain") return;
      const options = {
        version: "v4",
        action: "read",
        expires: Date.now() + 60 * 60 * 1000,
      };
      const [signedUrl] = await bucket.file(file.name).getSignedUrl(options);

      items.push({
        _id: file.metadata.metadata.dbID,
        type: file.metadata.metadata.type,
        timeCreated: file.metadata.timeCreated,
        timeUpdated: file.metadata.updated,
        signedUrl: signedUrl,
      });
    }

    const [library] = results.map((result) => {
      const match = items.filter((item) => item._id == result._id);
      if (match) {
        return {
          ...result,
          timeCreated: match[0].timeCreated,
          timeUpdated: match[0].timeUpdated,
          images: [
            ...match.map((item) => ({
              signedUrl: item.signedUrl,
              type: item.type,
            })),
          ],
        };
      }
      return result;
    });

    res.send(library).status(200);
  } catch (error) {
    console.error("Error listing bucket contents:", error);
    res.status(500).send(error);
  }
});

//FOR SCANNING, EXTERNAL URL
router.get("/analytics/:id", async (req, res) => {
  try {
    if (req.params.id !== null) {
      let collection = db.collection("staticAnalytics");
      const log = {
        action: "scanned",
        date: new Date().toISOString(),
      };
      const query = { _id: new ObjectId(req.params.id) };
      const response = await collection.updateOne(query, {
        $push: { logs: log },
      });

      if (response?.acknowledged) {
        let collection = db.collection("staticAds");
        const ad = await collection.findOne({
          _id: new ObjectId(req.params.id),
        });

        res.status(200).send(ad);
      }
    }
  } catch (error) {
    console.error("Error listing bucket contents:", error);
    res.status(500).send(error);
  }
});

router.put("/analytics/:id", async (req, res) => {
  try {
    const newLog = req.body;
    const id = req.params.id;
    const collection = db.collection("staticAnalytics");

    const result = await collection.findOne({ _id: new ObjectId(id) });

    let response;
    if (!result) {
      const log = {
        _id: new ObjectId(id),
        logs: [newLog],
      };
      response = await collection.insertOne(log);
    } else {
      const query = { _id: new ObjectId(id) };
      const updates = {
        $push: { logs: newLog }, // Directly pushing newLog to the array
      };
      response = await collection.updateOne(query, updates);
    }

    res.send(response).status(200);
  } catch (error) {
    console.error("Error listing bucket contents:", error);
    res.status(500).send(error);
  }
});
router.post("/create", upload.array("files", 2), async (req, res) => {
  try {
    const files = req.files;
    const data = JSON.parse(req.body.adData);

    if (!files || files.length !== 2) {
      return res.status(400).send("No files uploaded.");
    }

    let collection = db.collection("staticAds");
    let result = await collection.insertOne(data);

    files.forEach(async (file, index) => {
      file.originalname = "staticAds/" + file.originalname;

      const fileUpload = bucket.file(file.originalname);
      const stream = fileUpload.createWriteStream({
        metadata: {
          contentType: file.mimetype,
          metadata: {
            dbID: result.insertedId,
            type: index === 0 ? "main" : "thumbnail",
          },
        },
      });
      stream.on("error", (error) => {
        res.status(400).send(error);
        console.error(`Error uploading ${file.originalname}:`, error);
      });
      // Upload the file
      stream.end(file.buffer);
      await new Promise((resolve) => stream.on("finish", resolve));
    });

    res.status(200).send(result);
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
