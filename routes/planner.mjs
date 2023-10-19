import express from "express";
import db from "../db/conn.mjs";
import { ObjectId } from "mongodb";

const router = express.Router();
let collection = db.collection("planner");
let results;

//GET SCHEDULES
router.get("/", async (req, res) => {
  try {
    let query = {
      status: { $not: { $eq: "deleted" } },
    };
    results = await collection
      .aggregate([
        {
          $lookup: {
            from: "playlist",
            localField: "playlist_id",
            foreignField: "_id",
            as: "playlist",
          },
        },
        {
          $unwind: {
            path: "$playlist",
          },
        },
        {
          $project: {
            _id: 1,
            start_date: 1,
            end_date: 1,
            backgroundColor: 1,
            status: 1,
            playlist_id: 1,
            playlist_media: "$playlist.media_items",
          },
        },
        {
          $match: query,
        },
      ])
      .toArray();
    res.send(results).status(200);
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
});

// ADD SCHEDULE
router.post("/add", async (req, res) => {
  try {
    const schedule = req.body;
    const newSchedule = {
      playlist_id: new ObjectId(schedule.title),
      start_date: schedule.start,
      end_date: schedule.end,
      backgroundColor: schedule.backgroundColor,
      status: "active",
    };
    results = await collection.insertOne(newSchedule);

    if (results.acknowledged) {
      let collection = db.collection("playlist");
      results = await collection.findOne({ _id: new ObjectId(schedule.title) });
      const updates = {
        $inc: {
          usage: 1,
        },
      };
      results = await collection.updateOne(
        { _id: new ObjectId(results._id) },
        updates
      );
      res.send(results).status(200);
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
});

export default router;
