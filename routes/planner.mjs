import express from "express";
import db from "../db/conn.mjs";
import { ObjectId } from "mongodb";
import { format, getDay, isSameDay, parse } from "date-fns";

const router = express.Router();
let collection = db.collection("planner");
let results;
const dayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
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
            start: 1,
            end: 1,
            backgroundColor: 1,
            status: 1,
            playlist_id: 1,
            occurence: 1,
            playlist_media: "$playlist.media_items",
          },
        },
        {
          $match: query,
        },
      ])
      .toArray();

    let schedules = [];

    results.forEach((result) => {
      schedules = schedules.concat(generateSchedule(result));
    });
    res.send(schedules).status(200);
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
});
//get single schedule
router.get("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    let query = {
      _id: new ObjectId(id),
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
            start: 1,
            end: 1,
            backgroundColor: 1,
            status: 1,
            playlist_id: 1,
            occurence: 1,
            // playlist_media: "$playlist.media_items",
          },
        },
        {
          $match: query,
        },
      ])
      .toArray();
    if (results.length === 0) res.send("No results found.").status(400);

    const planner = results[0];

    res.send(planner).status(200);
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
      ...schedule,
      playlist_id: new ObjectId(schedule.playlist_id),
      status: "active",
    };
    results = await collection.insertOne(newSchedule);

    if (results.acknowledged) {
      let collection = db.collection("playlist");
      results = await collection.findOne({
        _id: new ObjectId(schedule.playlist_id),
      });
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
function generateSchedule(item) {
  const start_date = new Date(item.start);
  const end_date = new Date(item.end);
  let schedule = [];

  if (item.occurence.repeat === "everyday") {
    let current_date = new Date(start_date);
    while (current_date <= end_date) {
      const start_time = new Date(item.occurence.timeslot.start);
      const end_time = new Date(item.occurence.timeslot.end);
      schedule.push({
        id: item._id,
        start: new Date(
          current_date.getFullYear(),
          current_date.getMonth(),
          current_date.getDate(),
          start_time.getHours(),
          start_time.getMinutes()
        ),
        end: new Date(
          current_date.getFullYear(),
          current_date.getMonth(),
          current_date.getDate(),
          end_time.getHours(),
          end_time.getMinutes()
        ),
        playlist_id: item.playlist_id,
        backgroundColor: item.backgroundColor,
      });
      current_date.setDate(current_date.getDate() + 1);
    }
  } else if (item.occurence.repeat === "custom") {
    item.occurence.timeslot.forEach((timeslot) => {
      const day = timeslot.day.toLowerCase();
      let current_date = new Date(start_date);
      while (current_date <= end_date) {
        if (
          current_date
            .toLocaleDateString("en-US", { weekday: "long" })
            .toLowerCase() === day
        ) {
          const start_time = new Date(timeslot.start);
          const end_time = new Date(timeslot.end);
          schedule.push({
            id: item._id,
            start: new Date(
              current_date.getFullYear(),
              current_date.getMonth(),
              current_date.getDate(),
              start_time.getHours(),
              start_time.getMinutes()
            ),
            end: new Date(
              current_date.getFullYear(),
              current_date.getMonth(),
              current_date.getDate(),
              end_time.getHours(),
              end_time.getMinutes()
            ),
            playlist_id: item.playlist_id,
            backgroundColor: item.backgroundColor,
          });
        }
        current_date.setDate(current_date.getDate() + 1);
      }
    });
  }
  return schedule;
}

export default router;
