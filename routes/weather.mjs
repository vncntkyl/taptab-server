import express from "express";
import db from "../db/conn.mjs";
import { ObjectId } from "mongodb";
import { Storage } from "@google-cloud/storage";
import multer from "multer";
import { colllections } from "./collections.mjs";

const storage = new Storage({
  projectId: "taptab-418401",
  keyFilename: "taptab-418401-a7f87dfe0929.json",
});
const router = express.Router();
const bucket = storage.bucket("tap_ads");
//GET FILES
const upload = multer({ storage: multer.memoryStorage() });
const { weather } = colllections;

router.get("/", async (req, res) => {
  const params = req.query;
  try {
    const query = buildQuery(params);
    const results = await weather.find(query).toArray();
    const files = await filterFiles(await bucket.getFiles());
    const items = await buildItems(files, results);

    res.status(200).send(items);
  } catch (error) {
    console.error("Error fetching:", error);
    res.status(500).send({ error: "Internal Server Error" });
  }
});
router.get("/:id", async (req, res) => {});
router.post("/", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    const data = JSON.parse(req.body.data);
    /*
    data format
    name: string,
    trigger_temp: number
    trigger_unit: string  C || F (celsius or farenheit)
    weather: string sunny || rainy || cloudy
    runtime_date: date
    status: string active || inactive
  */
    let result = await weather.insertOne(data);

    file.originalname = "weatherAds/" + file.originalname;
    const fileUpload = bucket.file(file.originalname);
    const stream = fileUpload.createWriteStream({
      metadata: {
        contentType: file.mimetype,
        metadata: {
          dbID: result.insertedId,
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

    res.status(200).send({ acknowledged: true });
  } catch (error) {
    console.error("Error uploading: ", error);
    res.status(500).send(error);
  }
});
router.put("/:id", upload.single("file"), async (req, res) => {
  try {
    const data = JSON.parse(req.body.data);
    const image = req.file;
    let collection = db.collection("weatherAds");
    const query = { _id: new ObjectId(req.params.id) };
    const fileName = data.filename;
    delete data.filename;
    const updates = {
      $set: {
        ...data,
      },
    };
    let result = await collection.updateOne(query, updates);

    if (result.acknowledged) {
      if (image) {
        image.originalname = "weatherAds/" + image.originalname;
        await bucket.file(fileName).delete();
        const fileUpload = bucket.file(image.originalname);
        const stream = fileUpload.createWriteStream({
          metadata: {
            contentType: image.mimetype,
            metadata: {
              dbID: req.params.id,
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
    // res.send({ data: data, file: image }).status(200);
  } catch (error) {
    console.error("Error uploading: ", error);
    res.status(500).send(error);
  }
});
router.delete("/:id", async (req, res) => {
  const query = { _id: new ObjectId(req.params.id) };

  const updates = {
    $set: {
      status: "deleted",
    },
  };
  let result = await weather.updateOne(query, updates);

  res.send(result).status(200);
});

const buildQuery = (params) => {
  let query = { status: { $ne: "deleted" } };
  if (Object.keys(params).length > 0) {
    query.$and = [
      { weather: params.weather },
      { trigger_temperature: { $lte: params.temperature } },
    ];
  }

  return query;
};

const filterFiles = async ([files]) => {
  return files.filter(
    (file) =>
      file.name.startsWith("weatherAds") &&
      file.metadata.contentType !== "text/plain"
  );
};

const buildItems = async (files, results) => {
  const items = [];

  for (const file of files) {
    const result = results.find((result) =>
      result._id.equals(file.metadata.metadata.dbID)
    );

    if (result) {
      const signedUrl = await getSignedUrl(file);
      items.push({
        ...result,
        _id: file.metadata.metadata.dbID,
        _urlID: file.id,
        fileName: file.name,
        timeCreated: file.metadata.timeCreated,
        timeUpdated: file.metadata.updated,
        signedUrl: signedUrl,
      });
    }
  }

  return items;
};

const getSignedUrl = async (file) => {
  const options = {
    version: "v4",
    action: "read",
    expires: Date.now() + 60 * 60 * 1000,
  };

  const [signedUrl] = await bucket.file(file.name).getSignedUrl(options);
  return signedUrl;
};

export default router;
