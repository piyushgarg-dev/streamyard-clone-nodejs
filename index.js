
import http from "http";
import express from "express";
import path from "path";
import { spawn } from "child_process";
import { Server as SocketIO } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new SocketIO(server);

let key = '';
let ffmpegProcess;

const initialOptions = [
    '-i',
    '-',
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-tune', 'zerolatency',
    '-r', `${25}`,
    '-g', `${25 * 2}`,
    '-keyint_min', 25,
    '-crf', '25',
    '-pix_fmt', 'yuv420p',
    '-sc_threshold', '0',
    '-profile:v', 'main',
    '-level', '3.1',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', 128000 / 4,
    '-f', 'flv'
];

function startFfmpeg() {
    const options = [...initialOptions, `rtmp://a.rtmp.youtube.com/live2/${key}`];
    ffmpegProcess = spawn('ffmpeg', options);

    ffmpegProcess.stdout.on('data', (data) => {
        console.log(`ffmpeg stdout: ${data}`);
    });

    ffmpegProcess.stderr.on('data', (data) => {
        console.error(`ffmpeg stderr: ${data}`);
    });

    ffmpegProcess.on('close', (code) => {
        console.log(`ffmpeg process exited with code ${code}`);
    });
}

function stopFfmpeg() {
    if (ffmpegProcess) {
        ffmpegProcess.kill('SIGINT');
        console.log('ffmpeg process stopped.');
    }
}

app.use(express.static(path.resolve('./public')));

io.on('connection', socket => {
    console.log('Socket Connected:', socket.id);

    socket.on('key', userKey => {
        console.log('Received key:', userKey);
        key = userKey;
        if (ffmpegProcess) {
            stopFfmpeg();
            startFfmpeg();
        } else {
            startFfmpeg();
        }
    });

    socket.on('stop-stream', () => {
        console.log('Stopping stream...');
        stopFfmpeg();
    });

    socket.on('binarystream', stream => {
        if (ffmpegProcess && !ffmpegProcess.killed && ffmpegProcess.stdin && !ffmpegProcess.stdin.destroyed) {
            console.log('Binary Stream Incoming...');
            ffmpegProcess.stdin.write(stream, (err) => {
                if (err) {
                    console.error('Error writing to ffmpeg stdin:', err);
                }
            });
        } else {
            console.log('No active or valid stream to write to.');
        }
    });
});

server.listen(3000, () => {
    console.log(`Http server started running at PORT 3000.`);
});
