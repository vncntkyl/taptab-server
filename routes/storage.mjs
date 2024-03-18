import express from "express";
import db from "../db/conn.mjs";
import { ObjectId } from "mongodb";
import { Storage } from "@google-cloud/storage";
import multer from "multer";
import { differenceInMonths, format } from "date-fns";
import { colllections, geoTaggedAnalytics, players } from "./collections.mjs";
import {
  calculateDistance,
  getCount,
  getPlayerCount,
  groupByMonths,
  groupedByDays,
} from "./functions.mjs";
const storage = new Storage({
  projectId: "bustling-surf-398905",
  keyFilename: "bustling-surf-398905-cd0a4fd7ec7c.json",
});
const router = express.Router();
const bucket = storage.bucket("tamc_advertisements");
//GET FILES
const upload = multer({ storage: multer.memoryStorage() });

router.get("/", async (req, res) => {
  try {
    let collection = db.collection("media");
    let results = await collection.find({}).toArray();
    let [files] = await bucket.getFiles();
    const items = [];
    files = files.filter(
      (file) =>
        !file.name.startsWith("staticAds") &&
        !file.name.startsWith("geoTaggedAds")
    );
    files.forEach((file) => {
      if (file.metadata.contentType === "text/plain") return;
      items.push({
        _id: file.metadata.metadata.dbID,
        _urlID: file.id,
        fileName: file.name,
        category: results.find((result) =>
          result._id.equals(file.metadata.metadata.dbID)
        ).category,
        name: results.find((result) =>
          result._id.equals(file.metadata.metadata.dbID)
        ).name,
        contentType: file.metadata.contentType,
        size: file.metadata.size,
        bucket: file.metadata.bucket,
        timeCreated: file.metadata.timeCreated,
        timeUpdated: file.metadata.updated,
      });
    });
    const library = results.map((result) => {
      const match = items.find(
        (item) => item._id == result._id && !item.fileName.includes("tmb")
      );
      if (match) {
        return { ...result, ...match };
      }
      return result; // If no match is found, use the result from MongoDB
    });
    items
      .filter(
        (item) =>
          !results.find(
            (result) => result._id == item._id && !item.fileName.includes("tmb")
          )
      )
      .forEach((unmatchedItem) => {
        library.push(unmatchedItem);
      });

    results
      .filter((result) => !items.find((item) => item._id == result._id))
      .forEach((unmatchedResult) => {
        if (!library.find((item) => item._id === unmatchedResult._id)) {
          library.push(unmatchedResult);
        }
      });
    res.send(library).status(200);
  } catch (error) {
    console.error("Error listing bucket contents:", error);
    res.status(500).send(error);
  }
});
router.get("/media/:id", async (req, res) => {
  try {
    const id = req.params.id;
    let collection = db.collection("media");
    let result = await collection.findOne({ _id: new ObjectId(id) });
    collection = db.collection("analytics");
    let analytics = await collection.findOne({ media_id: new ObjectId(id) });
    let [files] = await bucket.getFiles();

    files = files.filter(
      (file) =>
        !file.name.startsWith("staticAds") &&
        !file.name.startsWith("geoTaggedAds")
    );
    files = files.filter((file) => {
      // Check if dbID is defined before comparing
      if (file.metadata) {
        if (typeof file.metadata.metadata === "object") {
          return file.metadata.metadata.dbID === id;
        }
      }
      return false;
    });
    const mediaItem = files.find((file) => !file.name.startsWith("thumbnail"));
    const mediaThumbnail = files.find((file) =>
      file.name.startsWith("thumbnail")
    );
    let item = {
      _id: result._id,
      category: result.category,
      name: result.name,
      type: result.type,
      duration: result.videoDuration,
      usage: result.usage,
      dimensions: {
        height: result.height,
        width: result.width,
      },
    };
    if (result.type === "link") {
      item = {
        ...item,
        _urlID: result.link,
        timeCreated: result.timeCreated,
        timeUpdated: result.updated,
        thumbnail: {
          fileName: mediaThumbnail.name,
          contentType: mediaThumbnail.metadata.contentType,
          size: mediaThumbnail.metadata.size,
          timeCreated: mediaThumbnail.metadata.timeCreated,
          timeUpdated: mediaThumbnail.metadata.updated,
        },
        logs: { ...analytics },
      };
    } else if (result.type === "image") {
      item = {
        ...item,
        _urlID: mediaItem.id,
        fileName: mediaItem.name,
        contentType: mediaItem.metadata.contentType,
        size: mediaItem.metadata.size,
        bucket: mediaItem.metadata.bucket,
        timeCreated: mediaItem.metadata.timeCreated,
        timeUpdated: mediaItem.metadata.updated,
        logs: { ...analytics },
      };
    } else {
      item = {
        ...item,
        _urlID: mediaItem.id,
        fileName: mediaItem.name,
        contentType: mediaItem.metadata.contentType,
        size: mediaItem.metadata.size,
        bucket: mediaItem.metadata.bucket,
        timeCreated: mediaItem.metadata.timeCreated,
        timeUpdated: mediaItem.metadata.updated,
        thumbnail: {
          fileName: mediaThumbnail.name,
          contentType: mediaThumbnail.metadata.contentType,
          size: mediaThumbnail.metadata.size,
          timeCreated: mediaThumbnail.metadata.timeCreated,
          timeUpdated: mediaThumbnail.metadata.updated,
        },
        logs: { ...analytics },
      };
    }

    // console.log(item);

    res.send(item).status(200);
  } catch (error) {
    console.error("Error listing bucket contents:", error);
    res.status(500).send(error);
  }
});

router.get("/playlist/", async (req, res) => {
  try {
    let collection = db.collection("playlist");
    let results = await collection.find({}).toArray();

    res.send(results).status(200);
  } catch (error) {
    console.error("Error listing bucket contents:", error);
    res.status(500).send(error);
  }
});
router.post("/playlist/upload", async (req, res) => {
  try {
    const newPlaylist = {
      ...req.body,
      usage: 0,
      time_created: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"),
    };
    let collection = db.collection("playlist");

    const { media_items } = newPlaylist;

    const result = await collection.insertOne(newPlaylist);
    if (result.acknowledged) {
      const IDs = media_items.map((id) => new ObjectId(id));
      collection = db.collection("media");
      const query = { _id: { $in: IDs } };
      const updates = {
        $inc: {
          usage: 1,
        },
      };
      let result = await collection.updateMany(query, updates);
      res.send(result).status(204);
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
});
router.patch("/playlist/:id", async (req, res) => {
  try {
    let collection = db.collection("playlist");
    const playlistData = req.body;
    const query = { _id: new ObjectId(req.params.id) };
    const updates = {
      $set: {
        ...playlistData,
      },
    };
    const results = await collection.updateOne(query, updates);

    res.status(200).send(results);
  } catch (error) {
    console.error("Error uploading: ", error);
    res.status(500).send(error);
  }
});

router.post("/upload", upload.array("files", 5), async (req, res) => {
  try {
    const files = req.files;
    const data = JSON.parse(req.body.mediaData);
    let collection = await db.collection("media");
    let result = await collection.insertOne(data);

    if (data.type === "image") {
      if (!files || files.length === 0) {
        return res.status(400).send("No files uploaded.");
      }
      files.forEach(async (file) => {
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
      });
    } else if (data.type === "video" || data.type === "link") {
      if (!files || files.length === 0) {
        return res.status(400).send("No files uploaded.");
      }

      files.forEach(async (file) => {
        if (file.originalname.includes("tmb")) {
          file.originalname = "thumbnail/" + file.originalname;
        }
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
      });
    }

    res.status(200).send({ acknowledged: true });
  } catch (error) {
    console.error("Error uploading: ", error);
    res.status(500).send(error);
  }
});
router.patch("/:id", async (req, res) => {
  try {
    let collection = db.collection("playlist");
    const data = req.body;
    const { fileName, thumbnail_src } = data;
    const fileNames = [fileName, thumbnail_src];

    await Promise.all(
      fileNames.map(async (file) => {
        try {
          if (!file) return;
          await bucket.file(file).delete();
          console.log(`File ${file} deleted successfully.`);
        } catch (error) {
          console.error(`Error deleting file ${file}: ${error.message}`);
        }
      })
    );
    let result = await collection.updateMany(
      {},
      {
        $pull: { media_items: req.params.id },
      }
    );

    if (result.acknowledged) {
      const query = { _id: new ObjectId(req.params.id) };
      collection = db.collection("media");
      result = await collection.deleteOne(query);
      res.send(result).status(200);
    }
  } catch (error) {
    console.error("Error uploading: ", error);
    res.status(500).send(error);
  }
});
router.patch("/analytics/:id", async (req, res) => {
  try {
    let collection = db.collection("analytics");
    let data = req.body.data;
    let id = req.params.id;
    const query = { media_id: new ObjectId(id) };
    const updates = {
      $push: { logs: { $each: data, $position: 0 } },
    };

    const results = await collection.updateOne(query, updates);
    res.send(results).status(200);
  } catch (e) {
    res.send(e).status(400);
  }
});

router.get("/analytics/", async (req, res) => {
  try {
    let collection = db.collection("analytics");
    let results = await collection.find({}).toArray();

    res.send(results).status(200);
  } catch (error) {
    console.error("Error listing bucket contents:", error);
    res.status(500).send(error);
  }
});

router.get("/geolocation/", async (req, res) => {
  try {
    const { geoTaggedAds } = colllections;
    let results = await geoTaggedAds.find({}).toArray();
    let [files] = await bucket.getFiles();
    const items = [];
    files = files.filter((file) => file.name.startsWith("geoTaggedAds"));
    files.forEach((file) => {
      if (file.metadata.contentType === "text/plain") return;

      const item = results.find((result) =>
        result._id.equals(file.metadata.metadata.dbID)
      );
      items.push({
        _id: file.metadata.metadata.dbID,
        _urlID: file.id,
        fileName: file.name,
        ...item,
        contentType: file.metadata.contentType,
        size: file.metadata.size,
        bucket: file.metadata.bucket,
        timeCreated: file.metadata.timeCreated,
        timeUpdated: file.metadata.updated,
      });
    });
    res.json(items).status(200);
  } catch (error) {
    console.error("Error listing bucket contents:", error);
    res.status(500).send(error);
  }
});
router.get("/geolocation/:id", async (req, res) => {
  try {
    const { geoTaggedAds } = colllections;
    let id = req.params.id;
    let result = await geoTaggedAds.findOne({ _id: new ObjectId(id) });
    let [files] = await bucket.getFiles();
    let ad;
    files = files.filter((file) => file.name.startsWith("geoTaggedAds"));
    ad = files.find((file) => file.metadata.metadata?.dbID === id);

    ad = {
      ...result,
      image: `https://storage.googleapis.com/tamc_advertisements/${ad.id}`,
      // size: ad.metadata.size,
      // bucket: ad.metadata.bucket,
      timeCreated: ad.metadata.timeCreated,
      timeUpdated: ad.metadata.updated,
    };
    res.json(ad).status(200);
  } catch (error) {
    console.error("Error listing bucket contents:", error);
    res.status(500).send(error);
  }
});
router.get("/geolocation/analytics/:id", async (req, res) => {
  try {
    // let bucket = storage.bucket("geo-ads-analytics");
    // [files] = await bucket.getFiles()

    // let id = req.params.id;
    // let result = await geoTaggedAds.findOne({ _id: new ObjectId(id) });
    // let [files] = await bucket.getFiles();
    // let ad;
    // files = files.filter((file) => file.name.startsWith("geoTaggedAds"));
    // ad = files.find((file) => file.metadata.metadata?.dbID === id);

    // ad = {
    //   ...result,
    //   image: `https://storage.googleapis.com/tamc_advertisements/${ad.id}`,
    //   // size: ad.metadata.size,
    //   // bucket: ad.metadata.bucket,
    //   timeCreated: ad.metadata.timeCreated,
    //   timeUpdated: ad.metadata.updated,
    // };

    const id = req.params.id;
    const { from, to } = JSON.parse(req.query.dates);

    const ad = geoTaggedAnalytics.find((ad) => ad._id === id);

    if (ad) {
      let metrics = ad.metrics;

      metrics.forEach((item) => {
        item.player_id = players[Math.floor(Math.random() * players.length)];
      });

      metrics = metrics.sort((a, b) => {
        return new Date(a.date_logged) - new Date(b.date_logged);
      });

      let filteredMetrics = [...metrics];
      if (from && to) {
        filteredMetrics = metrics.filter(
          (data) =>
            new Date(data.date_logged) > new Date(from) &&
            new Date(data.date_logged) < new Date(to)
        );
      }

      const analytics = {
        shows: metrics.length,
        scans: getCount(metrics, "isScanned", true).length,
        interactions: getCount(metrics, "isClosed", true).length,
        players: getPlayerCount(metrics),
        charts: [],
      };
      if (from && to) {
        const diffMonths = differenceInMonths(new Date(from), new Date(to));
        if (diffMonths < -1) {
          analytics.charts = groupByMonths(filteredMetrics);
        } else {
          analytics.charts = groupedByDays(filteredMetrics);
        }
      } else {
        analytics.charts = groupByMonths(metrics);
      }
      res.json(analytics).status(200);
    } else {
      res.send("No analytics found").status(400);
    }
  } catch (error) {
    console.error("Error listing bucket contents:", error);
    res.status(500).send(error);
  }
});
router.post("/geolocation/check-coordinates", async (req, res) => {
  try {
    const { geoTaggedAds } = colllections;
    let coords = req.body;

    if (!coords) {
      res.send("No coordinates passed").status(400);
    }

    let results = await geoTaggedAds.find({}).toArray();
    let [files] = await bucket.getFiles();

    let ad = results.find((result) => {
      return (
        calculateDistance(
          coords.lat,
          coords.lng,
          result.coords.lat,
          result.coords.lng
        ) < 150
      );
    });
    if (ad) {
      files = files.filter((file) => file.name.startsWith("geoTaggedAds"));
      let file = files.find((file) => {
        return file.metadata.metadata?.dbID.includes(ad._id);
      });

      if (file) {
        file = {
          ...ad,
          image: `https://storage.googleapis.com/tamc_advertisements/${file.id}`,
        };
      }
      res.json(file).status(200);
    } else {
      res.send("No ad found").status(400);
    }
  } catch (error) {
    console.error("Error listing bucket contents:", error);
    res.status(500).send(error);
  }
});
router.post("/geolocation/", upload.single("file"), async (req, res) => {
  try {
    const { geoTaggedAds } = colllections;
    const file = req.file;
    const data = JSON.parse(req.body.data);
    let result = await geoTaggedAds.insertOne(data);

    let bucket = storage.bucket("geo-ads-analytics");
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

    bucket = storage.bucket("tamc_advertisements");
    file.originalname = "geoTaggedAds/" + file.originalname;
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
router.put("/geolocation/:id", upload.single("file"), async (req, res) => {
  try {
    const data = JSON.parse(req.body.data);
    const image = req.file;
    const { geoTaggedAds } = colllections;
    const query = { _id: new ObjectId(req.params.id) };
    const updates = {
      $set: data,
    };
    let result = await geoTaggedAds.updateOne(query, updates);

    if (result.acknowledged) {
      if (image) {
        image.originalname = "geoTaggedAds/" + image.originalname;
        await bucket.file(data.imagePath).delete();
        const fileUpload = bucket.file(image.originalname);
        const stream = fileUpload.createWriteStream({
          metadata: {
            contentType: image.mimetype,
            metadata: {
              dbID: data._id,
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
export default router;
