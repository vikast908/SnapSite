#!/usr/bin/env node
// Native Messaging host for GetInspire -> yt-dlp bridge
// Receives JSON messages and responds with JSON frames.
// Commands:
//  - { cmd: 'probe', url }
//  - { cmd: 'download', url, format }

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function readMessage(stdin, cb){
  const header = Buffer.alloc(4);
  let headerPos = 0;
  let bodyLen = 0; let body = Buffer.alloc(0);
  const onData = (chunk) => {
    if (headerPos < 4){
      const need = Math.min(4-headerPos, chunk.length);
      chunk.copy(header, headerPos, 0, need);
      headerPos += need;
      chunk = chunk.slice(need);
      if (headerPos < 4) return; // wait more
      bodyLen = header.readUInt32LE(0);
      body = Buffer.alloc(0);
    }
    if (chunk.length){ body = Buffer.concat([body, chunk]); }
    if (body.length >= bodyLen){
      stdin.off('data', onData);
      cb(body.slice(0, bodyLen));
    }
  };
  stdin.on('data', onData);
}

function writeMessage(obj){
  const json = Buffer.from(JSON.stringify(obj));
  const len = Buffer.alloc(4); len.writeUInt32LE(json.length,0);
  process.stdout.write(len); process.stdout.write(json);
}

function findYtDlp(){
  const exeNames = ['yt-dlp', 'yt-dlp.exe'];
  for (const name of exeNames){
    try {
      const which = process.platform === 'win32' ? 'where' : 'which';
      const res = spawn(which, [name]);
      let out = '';
      res.stdout.on('data', d => out += d.toString());
      return new Promise((resolve)=>{
        res.on('close', (code)=> resolve(code === 0 ? out.split(/\r?\n/)[0].trim() : null));
      });
    } catch {}
  }
  return Promise.resolve(null);
}

async function run(){
  const ytdlpPath = await findYtDlp();
  if (!ytdlpPath){ writeMessage({ type:'error', error:'yt-dlp not found in PATH' }); process.exit(0); }

  readMessage(process.stdin, async (buf) => {
    let msg = null; try { msg = JSON.parse(buf.toString('utf8')); } catch { return writeMessage({ type:'error', error:'invalid-json' }); }
    if (msg.cmd === 'probe'){
      const args = ['-J', '--no-warnings', '--no-playlist', msg.url];
      const ps = spawn(ytdlpPath, args);
      let out=''; let err='';
      ps.stdout.on('data', d=> out += d.toString());
      ps.stderr.on('data', d=> err += d.toString());
      ps.on('close', (code)=>{
        if (code !== 0){ return writeMessage({ ok:false, error: err || ('yt-dlp failed: '+code) }); }
        try {
          const j = JSON.parse(out);
          const formats = Array.isArray(j.formats) ? j.formats.map(f => ({
            format_id: f.format_id, ext: f.ext, height: f.height, fps: f.fps, tbr: f.tbr
          })) : [];
          writeMessage({ ok:true, formats });
        } catch (e) { writeMessage({ ok:false, error:String(e) }); }
      });
    } else if (msg.cmd === 'download'){
      const fmt = msg.format || 'bestvideo*+bestaudio/best';
      const outTpl = '%(title)s-%(id)s.%(ext)s';
      const args = ['--newline', '--no-warnings', '--no-playlist', '-f', fmt, '-o', outTpl, '--merge-output-format', 'mp4', msg.url];
      const ps = spawn(ytdlpPath, args, { windowsHide: true });
      ps.stdout.on('data', (d)=>{
        const s = d.toString();
        // Progress lines example: [download]  12.3% of ... at  ... ETA 01:23
        const m = s.match(/\[download\]\s+(\d+(?:\.\d+)?)%/);
        if (m) {
          writeMessage({ type:'progress', pct: Number(m[1]) });
        } else if (/\[Merger\]|\[download\]|Destination|Merging|Deleting/i.test(s)) {
          writeMessage({ type:'status', text: s.trim().slice(0, 140) });
        }
      });
      let err=''; ps.stderr.on('data', d=> err += d.toString());
      ps.on('close', (code)=>{
        if (code !== 0) writeMessage({ type:'error', error: err || ('yt-dlp failed: '+code) });
        else writeMessage({ type:'done' });
      });
    } else {
      writeMessage({ type:'error', error:'unknown-cmd' });
    }
  });
}

run().catch(e=>{ writeMessage({ type:'error', error:String(e) }); });

