var express = require("express");
var bodyParser = require("body-parser");
var multer = require("multer");
var app = express();
var fs = require("fs");
var path = require("path");

const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg").path;
const ffprobePath = require("@ffprobe-installer/ffprobe").path;
const ffmpeg = require("fluent-ffmpeg");
ffmpeg.setFfmpegPath(ffmpegInstaller);
ffmpeg.setFfprobePath(ffprobePath);

app.use(bodyParser.json({ limit: "50mb" }));
app.use(
  bodyParser.urlencoded({
    limit: "50mb",
    extended: true,
    parameterLimit: 50000,
  })
);

// view engine setup
app.use(express.static("uploads"));

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + file.originalname);
  },
});

var upload = multer({ storage: storage });

app.post("/audio_concat", upload.array("files", 3), async function (req, res) {
  var fileinfo = req.files;
  try {
    let songs = fileinfo.map((item) => item.path);
    const audio = await audioConcat(songs);
    await fileRemove(fileinfo);
    res.send(audio);
  } catch (error) {
    console.log(error);
    await fileRemove(fileinfo);
    res.status(400).send(error);
   
  }
});

app.post(
  "/video",
  upload.fields([{ name: "video" }, { name: "audio" }]),
  async function (req, res) {
    var fileinfo = req.files;
    let deletedFiles = [];
    deletedFiles.push(fileinfo.video[0]);
    deletedFiles.push(fileinfo.audio[0]);
    try {
      const video = await replaceAudio(fileinfo.video[0].path,fileinfo.audio[0].path);
      await fileRemove(deletedFiles);
      res.send(video);
    } catch (error) {
      console.log(error);
      await fileRemove(deletedFiles);
      res.status(400).send(error);
    }
  }
);

app.listen(3000, function () {
  console.log("Working on port 3000");
});
// --------- File Delete ----
async function fileRemove(files) {
  return new Promise((resolve, reject) => {
    for (let index = 0; index < files.length; index++) {
      const element = files[index];
      fs.unlink(element.path, (err) => {
        if (err) reject(err);
        if (files.length == index + 1) {
          resolve("file was deleted");
        }
      });
    }
  });
}
// --------- Audio Concat ----
const audioConcat = (songs) => {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(`concat:${songs.join("|")}`)
      .outputOptions("-acodec copy")
      .save(`./uploads/concat.mp3`)
      .on("end", function () {
        resolve("/uploads/concat.mp3");
      })
      .on("error", function (err) {
        reject(err);
      })
      .run();
  });
};
// --------- Replace audio ----
const replaceAudio = (video, audio) => {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .addInput(video)
      .addInput(audio)
      .addOptions(["-map 0:v", "-map 1:a", "-c:v copy", "-shortest"])
      .format("mp4")
      .save(`./uploads/replaceAudio.mp4`)
      .on("end", function () {
        resolve("/uploads/replaceAudio.mp4");
      })
      .on("error", function (err) {
        reject(err);
      })
      .run();
  });
};
