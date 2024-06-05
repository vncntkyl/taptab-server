import express from "express";
import db from "../db/conn.mjs";
import { ObjectId } from "mongodb";
import { Storage } from "@google-cloud/storage";
import multer from "multer";
import fs from "fs";
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
      .find({ status: { $not: { $eq: "deleted" } } })
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
        _urlID: file.id,
        fileName: file.name,
        timeCreated: file.metadata.timeCreated,
        timeUpdated: file.metadata.updated,
        signedUrl: signedUrl,
      });
    }

    bucket = storage.bucket("static_analytics");
    [files] = await bucket.getFiles();

    let analytics = [];
    // Use Promise.all to wait for all streams to complete
    await Promise.all(
      files.map(async (file) => {
        const stream = file.createReadStream();
        let data = "";

        // Wrap the stream reading in a Promise
        const readStreamPromise = new Promise((resolve, reject) => {
          stream.on("data", (chunk) => {
            data += chunk;
          });

          stream.on("end", () => {
            const existingData = JSON.parse(data);
            analytics.push({
              _id: file.name.split(".")[0],
              views: existingData,
            });
            resolve(); // Resolve the Promise when the stream is complete
          });

          stream.on("error", (error) => {
            reject(error); // Reject the Promise on error
          });
        });

        await readStreamPromise; // Wait for the stream to complete before moving to the next file
      })
    );

    const library = results.map((result) => {
      const match = items.find((item) => item._id == result._id);
      if (match) {
        return { ...result, ...match };
      }
      return result;
    });

    const libraryWithAnalytics = library.map((item) => {
      const analytic = analytics.find((log) => log._id == item._id);

      if (analytic) {
        return {
          ...item,
          views: analytic.views,
        };
      } else {
        return {
          ...item,
          views: [],
        };
      }
    });
    res.send(libraryWithAnalytics).status(200);
  } catch (error) {
    console.error("Error listing bucket contents:", error);
    res.status(500).send(error);
  }
});

router.get("/analytics", async (req, res) => {
  try {
    const bucket = storage.bucket("static_analytics");
    const [files] = await bucket.getFiles();
    const currentDate = new Date();
    const monthBefore = format(
      new Date(new Date().setDate(currentDate.getDate() - 28)),
      "yyyy-MM-dd"
    );
    let analytics = [];
    await Promise.all(
      files.map(async (file) => {
        const stream = file.createReadStream();
        let data = "";

        // Wrap the stream reading in a Promise
        const readStreamPromise = new Promise((resolve, reject) => {
          stream.on("data", (chunk) => {
            data += chunk;
          });

          stream.on("end", () => {
            const existingData = JSON.parse(data);
            for (const data of existingData) {
              data._id = file.name.split(".")[0];
            }
            if (existingData.length !== 0) {
              analytics.push(existingData);
            }
            resolve(); // Resolve the Promise when the stream is complete
          });

          stream.on("error", (error) => {
            reject(error); // Reject the Promise on error
          });
        });

        await readStreamPromise; // Wait for the stream to complete before moving to the next file
      })
    );

    analytics = analytics.flat();

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

    analytics = analytics.filter((entry) => {
      return (
        new Date(entry.date) >= new Date(monthBefore) &&
        new Date(entry.date) <= currentDate
      );
    });
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
      .find({ status: { $not: { $eq: "deleted" } } })
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
        _urlID: file.id,
        fileName: file.name,
        timeCreated: file.metadata.timeCreated,
        timeUpdated: file.metadata.updated,
        signedUrl: signedUrl,
      });
    }

    bucket = storage.bucket("static_analytics");
    [files] = await bucket.getFiles();

    let analytics = [];
    // Use Promise.all to wait for all streams to complete
    await Promise.all(
      files.map(async (file) => {
        const stream = file.createReadStream();
        let data = "";

        // Wrap the stream reading in a Promise
        const readStreamPromise = new Promise((resolve, reject) => {
          stream.on("data", (chunk) => {
            data += chunk;
          });

          stream.on("end", () => {
            const existingData = JSON.parse(data);
            analytics.push({
              _id: file.name.split(".")[0],
              views: existingData,
            });
            resolve(); // Resolve the Promise when the stream is complete
          });

          stream.on("error", (error) => {
            reject(error); // Reject the Promise on error
          });
        });

        await readStreamPromise; // Wait for the stream to complete before moving to the next file
      })
    );

    const library = results.map((result) => {
      const match = items.find((item) => item._id == result._id);
      if (match) {
        return { ...result, ...match };
      }
      return result;
    });

    const libraryWithAnalytics = library.map((item) => {
      const analytic = analytics.find((log) => log._id == item._id);

      if (analytic) {
        return {
          ...item,
          views: analytic.views,
        };
      } else {
        return {
          ...item,
          views: [],
        };
      }
    });

    const item = libraryWithAnalytics.find((item) => item._id == req.params.id);
    res.send(item).status(200);
  } catch (error) {
    console.error("Error listing bucket contents:", error);
    res.status(500).send(error);
  }
});
router.get("/analytics/:id", async (req, res) => {
  try {
    if (req.params.id !== null) {
      let collection = db.collection("staticAds");
      let result = await collection.findOne({
        _id: new ObjectId(req.params.id),
      });
      const log = {
        action: "scanned",
        date: new Date(new Date().toISOString()).toISOString(),
      };
      const bucket = storage.bucket("static_analytics");

      const file = bucket.file(`${req.params.id}.json`);

      file.exists().then(async ([exists]) => {
        if (exists) {
          const readStream = file.createReadStream();

          let data = "";

          readStream.on("data", (chunk) => {
            data += chunk;
          });

          readStream.on("end", async () => {
            const existingData = JSON.parse(data);
            existingData.push(log);
            const updatedJsonString = JSON.stringify(existingData, null, 2);

            const stream = file.createWriteStream({
              metadata: {
                contentType: "application/json",
              },
            });

            // Handle errors during the upload
            stream.on("error", (error) => {
              res
                .status(400)
                .send({ error: "Error during upload", details: error });
              console.error(`Error uploading ${req.params.id}.json:`, error);
            });

            // Handle the completion of the upload
            stream.on("finish", () => {
              res.send(result).status(200);
            });
            stream.end(updatedJsonString);
          });
        }
      });

      // if (results.acknowledged) {
      //   res.send(result).status(200);
      // } else {
      //   res.send("An error occured").status(404);
      // }
    }
  } catch (error) {
    console.error("Error listing bucket contents:", error);
    res.status(500).send(error);
  }
});

router.put("/analytics/:id", async (req, res) => {
  try {
    const newLog = req.body;
    let id = req.params.id;
    const bucket = storage.bucket("static_analytics");

    const file = bucket.file(`${id}.json`);

    file.exists().then(async ([exists]) => {
      if (exists) {
        const readStream = file.createReadStream();

        let data = "";

        readStream.on("data", (chunk) => {
          data += chunk;
        });

        readStream.on("end", async () => {
          const existingData = JSON.parse(data);
          existingData.push(newLog);
          const updatedJsonString = JSON.stringify(existingData, null, 2);

          const stream = file.createWriteStream({
            metadata: {
              contentType: "application/json",
            },
          });

          // Handle errors during the upload
          stream.on("error", (error) => {
            res
              .status(400)
              .send({ error: "Error during upload", details: error });
            console.error(`Error uploading ${id}.json:`, error);
          });

          // Handle the completion of the upload
          stream.on("finish", () => {
            res.status(200).send({
              acknowledged: true,
              modified: "full",
            });
          });
          stream.end(updatedJsonString);
        });
      } else {
        const newData = JSON.stringify([
          {
            action: "viewed",
            date: new Date(new Date().toISOString()).toISOString(),
          },
        ]);
        const streamNewData = file.createWriteStream({
          metadata: {
            contentType: "application/json",
          },
        });
        streamNewData.on("error", (error) => {
          res
            .status(400)
            .send({ error: "Error during upload", details: error });
          console.error(`Error uploading ${id}.json:`, error);
        });
        streamNewData.on("finish", () => {
          console.log(`Empty JSON file ${id}.json uploaded`);
        });
        streamNewData.end(newData);
      }
    });
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
    let bucket = storage.bucket("static_analytics");
    // Create an empty JSON file
    const fileNewData = bucket.file(`${result.insertedId}.json`);
    fileNewData.exists().then(async ([exists]) => {
      if (!exists) {
        const newData = JSON.stringify([]);
        const streamNewData = fileNewData.createWriteStream({
          metadata: {
            contentType: "application/json",
          },
        });
        streamNewData.on("error", (error) => {
          res
            .status(400)
            .send({ error: "Error during upload", details: error });
          console.error(`Error uploading ${result.insertedId}.json:`, error);
        });
        streamNewData.on("finish", () => {
          console.log(`Empty JSON file ${result.insertedId}.json uploaded`);
        });
        streamNewData.end(newData);
      }
    });

    if (!image || image.length === 0) {
      return res.status(400).send("No image uploaded.");
    }

    bucket = storage.bucket("tap_ads");

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

    res.status(200).send({ acknowledged: true });
  } catch (error) {
    console.error("Error uploading: ", error);
    res.status(500).send(error);
  }
});

router.post("/update", async (req, res) => {
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
