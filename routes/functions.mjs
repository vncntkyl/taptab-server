import { ObjectId } from "mongodb";
import db from "../db/conn.mjs";

let collection = db.collection("players");

export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Radius of the earth in meters
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in meters
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

export function getCount(metrics, key) {
  return metrics
    .filter((item) => item[key] === true)
    .map((item) => {
      return {
        date: item.date,
        [key]: item[key],
      };
    });
}

export async function getPlayers(array = []) {
  const uniquePlayers = [...new Set(array.map((obj) => obj.driver.toString()))];

  const players = await Promise.all(
    uniquePlayers.map(async (player) => {
      const playerInfo = await getPlayer(player);
      return {
        player: playerInfo?.device_name || "N/A",
        passed_by: array.filter((item) => item.driver.toString() === player)
          .length,
      };
    })
  );

  return players;
}

export const groupedByDays = (array) => {
  const groupedDays = array.reduce((acc, obj) => {
    delete obj.driver;
    const date = new Date(obj.date);
    acc[date.toLocaleDateString()] = acc[date.toLocaleDateString()] || [];
    acc[date.toLocaleDateString()].push(obj);
    return acc;
  }, {});

  const data = Object.keys(groupedDays).map((key) => {
    return {
      day: key,
      records: groupedDays[key]?.length,
      clicks: groupedDays[key].filter((record) => record.isClosed)?.length || 0,
      scans: groupedDays[key].filter((record) => record.isScanned)?.length || 0,
    };
  });

  return data;
};

export const groupByMonths = (array) => {
  const monthly = array.reduce((acc, obj) => {
    delete obj.driver;
    const date = new Date(obj.date);
    const year = date.getFullYear();
    const month = date.toLocaleString("en-US", { month: "long" });
    const key = `${month} ${year}`; // Combine month and year into one key
    acc[key] = acc[key] || [];
    acc[key].push(obj);
    return acc;
  }, {});

  const data = Object.keys(monthly).map((key) => {
    return {
      day: key,
      records: monthly[key]?.length,
      clicks: monthly[key].filter((record) => record.isClosed)?.length || 0,
      scans: monthly[key].filter((record) => record.isScanned)?.length || 0,
    };
  });

  return data;
};

const getPlayer = async (id) => {
  try {
    const result = await collection.findOne(
      {
        _id: new ObjectId(id),
      },
      { projection: { isOnline: 0 } }
    );
    return result;
  } catch (error) {
    console.error(error);
  }
};
