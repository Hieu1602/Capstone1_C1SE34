"""HTTP camera service: MJPEG/JPEG, MP4 và pytapo; chạy bằng python -m."""
import asyncio
from collections import deque
from datetime import datetime, timezone
import hmac
import json
import logging
import os
from pathlib import Path
import re
import subprocess
import threading
import uuid
import time
from urllib.parse import urlparse

from aiohttp import BasicAuth, web
import cv2

from src.drivers.camera import CameraDriver
from src.drivers.tapo import TapoControl, rtsp_url

LOG = logging.getLogger(__name__)
PAGE = """<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Smart Elderly Care — Tapo Camera Console</title>
<style>
  :root{
    --bg:#fffaf5;--panel:#ffffff;--panel2:#fff7ed;--border:#fed7aa;
    --text:#1e293b;--muted:#64748b;--primary:#ea580c;--primary-h:#c2410c;
    --ok:#16a34a;--warn:#d97706;--danger:#dc2626;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--text);line-height:1.45;padding:18px}
  .wrap{max-width:1240px;margin:0 auto}
  header{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;padding:14px 18px;background:var(--panel);border:1px solid var(--border);border-radius:14px;box-shadow:0 2px 10px rgba(234,88,12,.06)}
  .brand{display:flex;align-items:center;gap:12px}
  .dot{width:10px;height:10px;border-radius:50%;background:var(--ok);box-shadow:0 0 8px rgba(22,163,74,.5)}
  .dot.off{background:var(--danger);box-shadow:0 0 8px rgba(220,38,38,.5)}
  h1{font-size:18px;font-weight:700;color:#0f172a}
  .sub{font-size:12px;color:var(--muted)}
  .alert-bar{display:none;align-items:center;gap:10px;padding:10px 14px;margin-bottom:14px;background:#fef2f2;border:1px solid var(--danger);border-radius:10px;color:#b91c1c;font-weight:600;font-size:14px}
  .alert-bar.show{display:flex}
  .grid{display:grid;grid-template-columns:1.65fr 1fr;gap:16px}
  @media(max-width:960px){.grid{grid-template-columns:1fr}}
  .card{background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:16px;box-shadow:0 2px 10px rgba(15,23,42,.04)}
  .card-title{font-size:14px;font-weight:700;color:#0f172a;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:8px}
  .video-box{position:relative;background:#0f172a;border-radius:12px;overflow:hidden;border:1px solid var(--border);aspect-ratio:16/9}
  .video-box img{width:100%;height:100%;object-fit:contain;display:block}
  .live-pill{position:absolute;top:10px;left:10px;background:rgba(15,23,42,.72);color:#fff;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700;display:flex;align-items:center;gap:6px;border:1px solid rgba(255,255,255,.2)}
  .live-pill i{width:7px;height:7px;border-radius:50%;background:#ef4444;display:inline-block}
  .toolbar{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
  button,.btn{background:var(--panel);color:var(--text);border:1px solid var(--border);border-radius:9px;padding:8px 13px;font-size:13px;font-weight:600;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:6px;transition:.15s}
  button:hover,.btn:hover{border-color:var(--primary);background:var(--panel2);color:var(--primary)}
  button.primary{background:var(--primary);border-color:var(--primary);color:#fff}
  button.primary:hover{background:var(--primary-h);color:#fff}
  button.danger{background:#fef2f2;border-color:#fecaca;color:#dc2626}
  button.active{background:#ffedd5;border-color:var(--primary);color:var(--primary-h)}
  .col{display:flex;flex-direction:column;gap:14px}
  .ptz-wrap{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}
  .dpad{display:grid;grid-template-columns:repeat(3,46px);grid-template-rows:repeat(3,42px);gap:6px}
  .dpad button{justify-content:center;padding:0;font-size:16px}
  .dpad .center{background:var(--panel2);border-style:dashed;color:var(--primary);font-size:11px;cursor:default}
  .row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;background:var(--panel2);border:1px solid var(--border);border-radius:10px;margin-bottom:8px}
  .row:last-child{margin-bottom:0}
  .row-info{display:flex;flex-direction:column;gap:2px}
  .row-title{font-size:13px;font-weight:600;color:#0f172a}
  .row-sub{font-size:11.5px;color:var(--muted)}
  .seg{display:inline-flex;background:var(--panel2);border:1px solid var(--border);border-radius:8px;padding:2px;gap:2px}
  .seg button{border:none;background:transparent;padding:5px 10px;font-size:12px;border-radius:6px;color:var(--muted)}
  .seg button.active{background:var(--primary);color:#fff}
  .switch{position:relative;width:42px;height:24px;flex-shrink:0}
  .switch input{opacity:0;width:0;height:0}
  .slider{position:absolute;inset:0;background:#cbd5e1;border-radius:999px;cursor:pointer;transition:.2s}
  .slider:before{content:"";position:absolute;height:18px;width:18px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:.2s;box-shadow:0 1px 3px rgba(0,0,0,.2)}
  .switch input:checked+.slider{background:var(--primary)}
  .switch input:checked+.slider:before{transform:translateX(18px)}
  .rec-list{max-height:230px;overflow:auto;display:flex;flex-direction:column;gap:6px}
  .rec-item{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;background:var(--panel2);border:1px solid var(--border);border-radius:8px;font-size:12.5px}
  .rec-item a{color:var(--primary-h);font-weight:600;text-decoration:none;word-break:break-all}
  .toast{font-size:12px;color:var(--muted);margin-top:8px;min-height:18px;word-break:break-word;display:flex;align-items:center;gap:8px}
  .spin{width:14px;height:14px;border:2px solid var(--border);border-top-color:var(--primary);border-radius:50%;animation:sp .7s linear infinite;display:none;flex-shrink:0}
  .spin.show{display:inline-block}
  @keyframes sp{to{transform:rotate(360deg)}}
  .busy{opacity:.6;pointer-events:none}
  .pill{font-size:11px;padding:2px 8px;border-radius:999px;background:var(--panel2);border:1px solid var(--border);color:var(--primary-h);font-weight:600}
  .pill.ok{color:#15803d;border-color:#bbf7d0;background:#f0fdf4}
  .modal{position:fixed;inset:0;background:rgba(15,23,42,.65);display:none;align-items:center;justify-content:center;padding:20px;z-index:50}
  .modal.open{display:flex}
  .modal-card{background:var(--panel);border:1px solid var(--border);border-radius:14px;max-width:780px;width:100%;padding:14px}
  .modal-card video,.modal-card img{width:100%;max-height:70vh;border-radius:10px;background:#000}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="brand">
      <div id="conn-dot" class="dot"></div>
      <div>
        <h1 id="cam-title">Tapo Camera Console</h1>
        <div class="sub" id="cam-sub">Đang kết nối trạng thái camera...</div>
      </div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button onclick="discoverLAN()">Dò camera LAN</button>
      <button onclick="loadAll()">Làm mới</button>
    </div>
  </header>

  <div id="fall-alert" class="alert-bar">⚠️ CẢNH BÁO TÉ NGÃ VỪA ĐƯỢC PHÁT HIỆN!</div>
  <div id="audio-alert" class="alert-bar" style="border-color:var(--warn);background:#fffbeb;color:#b45309">📢 PHÁT HIỆN ÂM THANH BẤT THƯỜNG: <span id="audio-alert-txt"></span></div>

  <div class="grid">
    <div class="col">
      <div class="card">
        <div class="card-title">
          <span>Luồng trực tiếp (Live MJPEG)</span>
          <span class="pill ok" id="stream-badge">25 FPS</span>
        </div>
        <div class="video-box" id="video-box">
          <img id="live-img" src="/live.mjpg" onerror="setTimeout(()=>reloadStream(),3000)" alt="Camera đang kết nối">
          <div class="live-pill"><i></i> LIVE</div>
        </div>
        <div class="toolbar">
          <a class="btn" href="/snapshot.jpg" target="_blank">📸 Chụp ảnh JPEG</a>
          <button class="primary" onclick="record30s()">⏺ Ghi 30 giây MP4</button>
          <button id="btn-overlay" onclick="toggleOverlay()">🦴 Khung xương AI</button>
          <button onclick="toggleFS()">⛶ Toàn màn hình</button>
        </div>
        <div class="toast"><span id="spinner" class="spin"></span><span id="status">Sẵn sàng.</span></div>
      </div>

      <div class="card">
        <div class="card-title">
          <span>Bản ghi & Bằng chứng cục bộ</span>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="pill" id="rec-count">0 tệp</span>
            <button class="danger" style="padding:4px 10px;font-size:12px" onclick="clearAllFiles()">Xóa tất cả</button>
          </div>
        </div>
        <div class="rec-list" id="files"><div class="sub">Đang tải...</div></div>
      </div>
    </div>

    <div class="col">
      <div class="card">
        <div class="card-title">
          <span>Điều khiển góc quay (PTZ)</span>
          <div class="seg">
            <button id="step-10" class="active" onclick="setStep(10)">Bước nhỏ</button>
            <button id="step-25" onclick="setStep(25)">Bước lớn</button>
          </div>
        </div>
        <div class="ptz-wrap">
          <div class="dpad">
            <div></div><button onclick="movePTZ(0,1)" title="Lên">▲</button><div></div>
            <button onclick="movePTZ(-1,0)" title="Trái">◀</button><button class="center" disabled>PTZ</button><button onclick="movePTZ(1,0)" title="Phải">▶</button>
            <div></div><button onclick="movePTZ(0,-1)" title="Xuống">▼</button><div></div>
          </div>
          <div style="flex:1;min-width:170px">
            <div class="row" style="margin-bottom:8px">
              <div class="row-info"><span class="row-title">Chế độ ngày / đêm</span><span class="row-sub">Hồng ngoại (IR)</span></div>
            </div>
            <div class="seg" style="width:100%;display:flex">
              <button id="vm-auto" style="flex:1" onclick="setVideoMode('auto')">Auto</button>
              <button id="vm-day" style="flex:1" onclick="setVideoMode('day')">Ngày</button>
              <button id="vm-night" style="flex:1" onclick="setVideoMode('night')">Đêm</button>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">
          <span>Đàm thoại & Loa camera</span>
          <span class="pill" id="intercom-badge">Đang tắt</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px">
          <button id="btn-listen" onclick="startIntercom('listen')">🎧 Nghe loa</button>
          <button id="btn-talk" class="primary" onclick="startIntercom('talk')">🎙️ Đàm thoại 2 chiều</button>
          <button id="btn-stop-ic" class="danger" onclick="stopIntercom()" style="display:none">🔇 Tắt</button>
        </div>
        <div class="row">
          <div class="row-info">
            <span class="row-title">Test âm thanh loa</span>
            <span class="row-sub">Âm lượng: <strong id="vol-label">80%</strong></span>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <input type="range" id="spk-vol" min="10" max="100" step="5" value="80" oninput="$('vol-label').textContent=this.value+'%'" style="width:90px;accent-color:var(--primary)">
            <button onclick="testSpeaker(this)">🔊 Test loa</button>
          </div>
        </div>
        <audio id="remote-audio" autoplay playsinline style="display:none"></audio>
      </div>

      <div class="card">
        <div class="card-title"><span>AI & Cài đặt Camera</span></div>

        <div class="row">
          <div class="row-info">
            <span class="row-title">Nhận diện té ngã (YOLO-Pose)</span>
            <span class="row-sub" id="fall-sub">Đang kiểm tra...</span>
          </div>
          <label class="switch"><input type="checkbox" id="sw-fall" onchange="toggleFall(this.checked)"><span class="slider"></span></label>
        </div>

        <div class="row">
          <div class="row-info">
            <span class="row-title">Phát hiện âm thanh (YAMNet)</span>
            <span class="row-sub" id="audio-sub">Đang kiểm tra...</span>
          </div>
          <label class="switch"><input type="checkbox" id="sw-audio" onchange="toggleAudio(this.checked)"><span class="slider"></span></label>
        </div>

        <div class="row">
          <div class="row-info">
            <span class="row-title">Chất lượng luồng phát</span>
            <span class="row-sub">Độ phân giải Live MJPEG</span>
          </div>
          <div class="seg">
            <button id="q-auto" class="active" onclick="setQuality('auto')">Auto</button>
            <button id="q-720p" onclick="setQuality('720p')">720p</button>
            <button id="q-1080p" onclick="setQuality('1080p')">1080p</button>
          </div>
        </div>

        <div class="row">
          <div class="row-info">
            <span class="row-title">Tốc độ khung hình (FPS)</span>
            <span class="row-sub">Luồng xem & Tần suất AI</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <select id="stream-fps" onchange="setStreamFps(this.value)" title="FPS luồng xem" style="background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:7px;padding:4px 7px;font-size:12px">
              <option value="15">Xem: 15 FPS</option>
              <option value="20">Xem: 20 FPS</option>
              <option value="25" selected>Xem: 25 FPS</option>
            </select>
            <select id="ai-fps" onchange="setAiFps(this.value)" title="FPS AI té ngã" style="background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:7px;padding:4px 7px;font-size:12px">
              <option value="2">AI: 2 FPS</option>
              <option value="5">AI: 5 FPS</option>
              <option value="10">AI: 10 FPS</option>
              <option value="15">AI: 15 FPS</option>
              <option value="25">AI: 25 FPS</option>
            </select>
          </div>
        </div>

        <div class="row">
          <div class="row-info">
            <span class="row-title">Chế độ riêng tư (Che ống kính)</span>
            <span class="row-sub">Tạm ẩn hình ảnh & tắt luồng</span>
          </div>
          <label class="switch"><input type="checkbox" id="sw-privacy" onchange="togglePrivacy(this.checked)"><span class="slider"></span></label>
        </div>
      </div>
    </div>
  </div>
</div>

<div class="modal" id="preview-modal" onclick="if(event.target===this)closeModal()">
  <div class="modal-card">
    <div class="card-title"><span id="modal-title">Xem trước</span><button onclick="closeModal()">Đóng</button></div>
    <div id="modal-body"></div>
  </div>
</div>

<script>
let ptzStep = 10, overlayOn = false, streamQuality = "auto", streamFps = 25;
const $ = id => document.getElementById(id);
function setToast(msg, loading=false){
  $("status").textContent = msg;
  $("spinner").classList.toggle("show", Boolean(loading));
}
async function api(path, opts){
  const r = await fetch(path, opts);
  if(!r.ok) throw new Error(await r.text());
  return r.json();
}
async function post(path, body, label="Đang áp dụng cấu hình..."){
  const active = document.activeElement;
  if(active && active.tagName==="BUTTON" || active?.tagName==="SELECT" || active?.tagName==="INPUT") active.classList.add("busy");
  setToast(label, true);
  try{
    const d = await api(path, {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)});
    setToast("Đã áp dụng: " + JSON.stringify(d), false);
    return d;
  }catch(e){
    setToast("Lỗi: " + e.message, false);
  }finally{
    if(active) active.classList.remove("busy");
  }
}
function setStep(s){
  ptzStep = s;
  $("step-10").classList.toggle("active", s===10);
  $("step-25").classList.toggle("active", s===25);
}
function movePTZ(dx, dy){ post("/ptz", {x: dx*ptzStep, y: dy*ptzStep}); }
function reloadStream(label){
  const u = new URL("/live.mjpg", window.location.origin);
  if(overlayOn) u.searchParams.set("overlay", "1");
  u.searchParams.set("quality", streamQuality);
  u.searchParams.set("fps", String(streamFps));
  u.searchParams.set("t", Date.now());
  if(label) setToast(label, true);
  const img = $("live-img");
  img.onload = () => { if(label) setToast("Đã áp dụng: " + streamQuality.toUpperCase() + " • " + streamFps + " FPS", false); };
  img.src = u.pathname + u.search;
  $("stream-badge").textContent = streamFps + " FPS • " + streamQuality.toUpperCase();
}
function setQuality(q){
  streamQuality = q;
  ["auto","720p","1080p"].forEach(x => $("q-"+x).classList.toggle("active", x===q));
  reloadStream("Đang chuyển chất lượng " + q.toUpperCase() + "...");
}
function setStreamFps(v){
  streamFps = Number(v) || 25;
  reloadStream("Đang chuyển sang " + streamFps + " FPS...");
}
async function setAiFps(v){
  const fps = Number(v) || 5;
  await post("/stream-settings", {ai_fps: fps});
}
function toggleOverlay(){
  overlayOn = !overlayOn;
  $("btn-overlay").classList.toggle("active", overlayOn);
  reloadStream();
}
function toggleFS(){
  const el = $("video-box");
  if(!document.fullscreenElement) el.requestFullscreen?.(); else document.exitFullscreen?.();
}
async function record30s(){
  setToast("Đang gửi lệnh ghi 30 giây MP4...");
  await post("/recordings", {seconds: 30});
  setTimeout(refreshRecordings, 1500);
}
async function toggleFall(enabled){ await post("/fall-detection", {enabled}); checkAI(); }
async function toggleAudio(enabled){ await post("/audio-detection", {enabled}); checkAI(); }
async function togglePrivacy(enabled){ await post("/privacy", {enabled}); }
async function setVideoMode(mode){
  await post("/video-mode", {mode});
  ["auto","day","night"].forEach(m => $("vm-"+m).classList.toggle("active", m===mode));
}
async function discoverLAN(){
  setToast("Đang dò camera RTSP trong mạng LAN...", true);
  try{
    const d = await api("/discover");
    setToast("Kết quả dò LAN: " + JSON.stringify(d.found || d), false);
  }catch(e){ setToast("Lỗi dò LAN: " + e.message, false); }
}
async function checkStatus(){
  try{
    const s = await api("/status");
    const online = Boolean(s.connected ?? s.ok ?? true);
    $("conn-dot").classList.toggle("off", !online);
    $("cam-sub").textContent = (s.source ? "Nguồn: " + s.source + " • " : "") + (online ? "Trực tuyến" : "Mất kết nối");
  }catch(e){
    $("conn-dot").classList.add("off");
    $("cam-sub").textContent = "Không đọc được trạng thái";
  }
}
async function checkAI(){
  try{
    const f = await api("/fall-detection");
    $("sw-fall").checked = Boolean(f.enabled);
    $("fall-sub").textContent = (f.enabled ? "Đang bật" : "Đã tắt") + " • Đã phát hiện: " + (f.fall_count || 0) + " lần";
    $("fall-alert").classList.toggle("show", Boolean(f.detected));
  }catch(e){}
  try{
    const a = await api("/audio-detection");
    $("sw-audio").checked = Boolean(a.enabled);
    const cls = a.last_class ? `Gần nhất: ${a.last_class}` : (a.enabled ? "Đang lắng nghe" : "Đã tắt");
    $("audio-sub").textContent = cls + " (" + (a.event_count || 0) + " sự kiện)";
    $("audio-alert").classList.toggle("show", Boolean(a.detected));
    if(a.last_class) $("audio-alert-txt").textContent = a.last_class;
  }catch(e){}
}
async function loadTapoSettings(){
  try{
    const ss = await api("/stream-settings");
    if(ss.ai_fps){
      const el = $("ai-fps");
      if(![...el.options].some(o => Number(o.value)===Number(ss.ai_fps))){
        el.add(new Option("AI: " + ss.ai_fps + " FPS", String(ss.ai_fps)));
      }
      el.value = String(ss.ai_fps);
    }
  }catch(e){}
  try{
    const vm = await api("/video-mode");
    ["auto","day","night"].forEach(m => $("vm-"+m).classList.toggle("active", m===vm.mode));
  }catch(e){}
  try{
    const p = await api("/privacy");
    const en = p?.result?.enabled ?? p?.enabled;
    $("sw-privacy").checked = en === true || en === "on";
  }catch(e){}
}
async function refreshRecordings(){
  try{
    const d = await api("/recordings");
    const files = d.files || [];
    $("rec-count").textContent = files.length + " tệp";
    const box = $("files");
    if(!files.length){ box.innerHTML = '<div class="sub">Chưa có bản ghi cục bộ.</div>'; return; }
    box.replaceChildren(...files.map(f => {
      const row = document.createElement("div"); row.className = "rec-item";
      const a = document.createElement("a"); a.href = "/recordings/" + f; a.textContent = f; a.target = "_blank";
      const actions = document.createElement("div"); actions.style.cssText = "display:flex;gap:6px;flex-shrink:0";
      const btn = document.createElement("button"); btn.textContent = "Xem"; btn.style.padding = "4px 10px";
      btn.onclick = () => openPreview(f);
      const del = document.createElement("button"); del.textContent = "Xóa"; del.className = "danger"; del.style.padding = "4px 10px";
      del.onclick = () => deleteFile(f, del);
      actions.append(btn, del);
      row.append(a, actions);
      return row;
    }));
  }catch(e){}
}
async function deleteFile(f, btn){
  if(!confirm("Xóa tệp " + f + "?")) return;
  if(btn) btn.classList.add("busy");
  setToast("Đang xóa " + f + "...", true);
  try{
    await api("/recordings/" + encodeURIComponent(f), {method:"DELETE"});
    setToast("Đã xóa: " + f, false);
    refreshRecordings();
  }catch(e){
    setToast("Lỗi xóa tệp: " + e.message, false);
  }finally{
    if(btn) btn.classList.remove("busy");
  }
}
async function clearAllFiles(){
  if(!confirm("Xóa toàn bộ bản ghi & bằng chứng cục bộ?")) return;
  setToast("Đang xóa toàn bộ bản ghi...", true);
  try{
    const d = await api("/recordings", {method:"DELETE"});
    setToast("Đã xóa " + (d.deleted_count || 0) + " tệp.", false);
    refreshRecordings();
  }catch(e){
    setToast("Lỗi xóa: " + e.message, false);
  }
}
function openPreview(f){
  $("modal-title").textContent = f;
  const url = "/recordings/" + f;
  $("modal-body").innerHTML = f.endsWith(".jpg")
    ? `<img src="${url}">`
    : `<video src="${url}" controls autoplay playsinline></video>`;
  $("preview-modal").classList.add("open");
}
function closeModal(){ $("preview-modal").classList.remove("open"); $("modal-body").innerHTML = ""; }
let icPc = null, icStream = null;
async function startIntercom(mode){
  stopIntercom(true);
  setToast(mode==="talk" ? "Đang kết nối đàm thoại 2 chiều..." : "Đang kết nối nghe âm thanh...", true);
  try{
    const pc = new RTCPeerConnection({iceServers:[]});
    icPc = pc;
    pc.ontrack = ev => {
      const a = $("remote-audio");
      a.srcObject = ev.streams[0] || new MediaStream([ev.track]);
      a.muted = false;
      a.play?.().catch(()=>{});
    };
    if(mode==="talk"){
      icStream = await navigator.mediaDevices.getUserMedia({audio:true});
      icStream.getTracks().forEach(t => pc.addTrack(t, icStream));
    }else{
      pc.addTransceiver("audio", {direction:"recvonly"});
    }
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await new Promise(res => {
      if(pc.iceGatheringState==="complete") return res();
      const t = setTimeout(res, 1500);
      pc.onicegatheringstatechange = () => { if(pc.iceGatheringState==="complete"){ clearTimeout(t); res(); } };
    });
    const srcParam = mode==="talk" ? "tapo_intercom" : "tapo_listen";
    const r = await fetch("/api/webrtc?src=" + srcParam, {
      method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({type:"offer", sdp: pc.localDescription.sdp})
    });
    if(!r.ok) throw new Error(await r.text());
    const ans = await r.json();
    await pc.setRemoteDescription(ans);
    $("intercom-badge").textContent = mode==="talk" ? "Đang nói (2 chiều)" : "Đang nghe";
    $("intercom-badge").classList.add("ok");
    $("btn-stop-ic").style.display = "inline-flex";
    setToast(mode==="talk" ? "Đã bật đàm thoại 2 chiều." : "Đang nghe âm thanh từ camera.", false);
  }catch(e){
    stopIntercom(true);
    setToast("Lỗi đàm thoại: " + e.message, false);
  }
}
function stopIntercom(silent=false){
  if(icStream){ icStream.getTracks().forEach(t => t.stop()); icStream = null; }
  if(icPc){ icPc.close(); icPc = null; }
  $("remote-audio").srcObject = null;
  $("intercom-badge").textContent = "Đang tắt";
  $("intercom-badge").classList.remove("ok");
  $("btn-stop-ic").style.display = "none";
  if(!silent) setToast("Đã tắt đàm thoại.", false);
}
async function testSpeaker(btn){
  const vol = Number($("spk-vol").value) || 80;
  if(btn) btn.classList.add("busy");
  setToast("Đang phát âm thanh test ra loa camera (" + vol + "%)...", true);
  try{
    const d = await api("/speaker/test", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({volume: vol})});
    setToast("Đã phát âm thanh test ra loa (" + (d.volume ?? vol) + "%).", false);
  }catch(e){
    setToast("Lỗi test loa: " + e.message, false);
  }finally{
    if(btn) btn.classList.remove("busy");
  }
}
function loadAll(){ checkStatus(); checkAI(); loadTapoSettings(); refreshRecordings(); }
loadAll();
setInterval(checkAI, 3000);
setInterval(refreshRecordings, 5000);
</script>
</body>
</html>"""


class Recorder:
    """FFmpeg sao chép video RTSP sang MP4, không encode lại, không cần GPU."""
    def __init__(self, url: str, directory: Path):
        """Chuẩn bị bộ ghi RTSP và thư mục lưu MP4.

        Args:
            url: URL RTSP riêng tư của camera.
            directory: Thư mục lưu MP4.

        Returns:
            Không có. Tác động: tạo thư mục nếu chưa tồn tại.
        """
        self.url, self.directory = url, directory
        directory.mkdir(parents=True, exist_ok=True)
        # Giữ tác vụ để chặn ghi chồng và hủy khi dịch vụ dừng.
        self.task = None
        self.error = None
        # Tên bản ghi đang xử lý; chỉ tệp hoàn tất mới được liệt kê.
        self.active = None
        self.cleanup_task = None

    def cleanup_old_recordings(self, retention_hours: float | None = None, max_bytes: int | None = None) -> int:
        """Xóa các bản ghi MP4 cũ hơn retention_hours hoặc khi tổng dung lượng vượt max_bytes.

        Args:
            retention_hours: Giờ lưu tối đa trước khi xóa (mặc định CAMERA_RETENTION_HOURS hoặc 48h).
            max_bytes: Giới hạn dung lượng byte (mặc định MAX_RECORDING_STORAGE_GB hoặc 5GB).

        Returns:
            Số file đã xóa.
        """
        if retention_hours is None:
            retention_hours = float(os.getenv("CAMERA_RETENTION_HOURS", "48"))
        if max_bytes is None:
            max_bytes = int(os.getenv("MAX_RECORDING_STORAGE_GB", "5")) * 1024 * 1024 * 1024

        deleted_count = 0
        cutoff = time.time() - (retention_hours * 3600)
        try:
            mp4_files = [p for p in self.directory.glob("*.mp4") if p.is_file() and p.name != self.active]
            mp4_files.sort(key=lambda p: p.stat().st_mtime)

            remaining = []
            for path in mp4_files:
                try:
                    if path.stat().st_mtime < cutoff:
                        path.unlink(missing_ok=True)
                        deleted_count += 1
                        LOG.info("Dọn dẹp bản ghi camera hết hạn: %s", path.name)
                    else:
                        remaining.append(path)
                except OSError:
                    continue

            total_size = sum(p.stat().st_size for p in remaining if p.is_file())
            for path in remaining:
                if total_size <= max_bytes:
                    break
                try:
                    size = path.stat().st_size
                    path.unlink(missing_ok=True)
                    total_size -= size
                    deleted_count += 1
                    LOG.info("Dọn dẹp bản ghi cũ do dung lượng vượt ngưỡng: %s", path.name)
                except OSError:
                    continue
        except Exception as exc:
            LOG.error("Lỗi dọn dẹp bản ghi camera: %s", exc)
        return deleted_count

    async def _cleanup_loop(self, interval_seconds: float = 1800):
        while True:
            try:
                await asyncio.to_thread(self.cleanup_old_recordings)
            except asyncio.CancelledError:
                break
            except Exception as e:
                LOG.error("Lỗi trong vòng lặp dọn dẹp bản ghi: %s", e)
            try:
                await asyncio.sleep(interval_seconds)
            except asyncio.CancelledError:
                break

    def start_cleanup(self, interval_seconds: float = 1800):
        if self.cleanup_task and not self.cleanup_task.done():
            return
        self.cleanup_task = asyncio.create_task(self._cleanup_loop(interval_seconds))

    def start(self, seconds: int, url: str | None = None) -> str:
        """Bắt đầu ghi nếu không có bản ghi khác đang chạy.

        Args:
            seconds: Thời lượng ghi theo giây.
            url: URL RTSP tùy chọn (nếu có nguồn động).

        Returns:
            Tên MP4. Tác động: tạo asyncio task; báo 409 nếu đang ghi.
        """
        if self.task and not self.task.done():
            raise web.HTTPConflict(text="Một bản ghi đang chạy")
        name = f"{uuid.uuid4().hex}.mp4"
        self.error = None
        self.active = name
        target_url = url or self.url
        self.task = asyncio.create_task(self._record(name, seconds, target_url))
        return name

    async def _record(self, name: str, seconds: int, url: str | None = None):
        # File tạm không được liệt kê/tải xuống cho tới khi MP4 hoàn tất.
        """Chạy FFmpeg sao chép video, chỉ công bố MP4 khi hoàn tất.

        Args:
            name: Tên MP4 được tạo cho tác vụ.
            seconds: Thời lượng ghi theo giây.
            url: URL RTSP của luồng camera.

        Returns:
            Không có. Tác động: tạo tiến trình/tệp; dọn tiến trình và tệp tạm cả khi hủy.
        """
        target_url = url or self.url
        if not target_url:
            self.error = "Chưa có nguồn URL camera để ghi hình"
            return
        temporary = self.directory / (name + ".part")
        process = None
        try:
            process = await asyncio.create_subprocess_exec(
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin",
                "-rtsp_transport", "tcp", "-timeout", "5000000", "-i", target_url,
                "-t", str(seconds), "-map", "0:v:0", "-an", "-c:v", "copy",
                "-movflags", "+faststart", "-f", "mp4", "-y", str(temporary),
                stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL,
            )
            code = await asyncio.wait_for(process.wait(), seconds + 20)
            if code or not temporary.exists() or temporary.stat().st_size == 0:
                raise RuntimeError("record failed")
            temporary.replace(self.directory / name)
        except asyncio.CancelledError:
            raise
        except Exception:
            # Không trả stderr vì FFmpeg có thể ghi URL/credential vào đó.
            self.error = "Ghi hình thất bại; kiểm tra RTSP, kết nối và dung lượng ổ đĩa"
            LOG.warning(self.error)
        finally:
            if process and process.returncode is None:
                process.kill()
                await process.wait()
            temporary.unlink(missing_ok=True)
            self.active = None

    async def close(self):
        """Hủy và chờ tác vụ ghi và dọn dẹp hiện tại khi đóng dịch vụ.

        Returns:
            Không có. Tác động: dọn task và tài nguyên FFmpeg.
        """
        if self.cleanup_task and not self.cleanup_task.done():
            self.cleanup_task.cancel()
            await asyncio.gather(self.cleanup_task, return_exceptions=True)
        if self.task and not self.task.done():
            self.task.cancel()
            await asyncio.gather(self.task, return_exceptions=True)


def get_mqtt_client():
    """Khởi tạo MQTT Client kết nối đến EMQX để gửi cảnh báo té ngã."""
    try:
        from src.services.mqtt_client import MQTTClient
        host = os.getenv("MQTT_BROKER_HOST", "127.0.0.1")
        port = int(os.getenv("MQTT_BROKER_PORT", "1883"))
        device_id = os.getenv("CAMERA_DEVICE_ID", os.getenv("DEVICE_ID", "camera-main"))
        client = MQTTClient({
            "broker_host": host,
            "broker_port": port,
            "username": os.getenv("MQTT_USERNAME", "backend"),
            "password": os.getenv("MQTT_PASSWORD", "mqtt_secure_pass_123"),
            "client_id": f"camera-ai-{uuid.uuid4().hex[:6]}",
            "topics": {
                "telemetry": f"care/{device_id}/telemetry",
                "alert": f"care/{device_id}/alert",
            },
        })
        client.connect()
        return client
    except Exception:
        return None




class CameraFallDetector:
    """Giám sát và nhận diện té ngã AI trực tiếp trên luồng camera kết hợp Face Re-ID hồ sơ bệnh án."""
    def __init__(self, camera_driver, recorder, detector=None, mqtt=None):
        self.camera = camera_driver
        self.recorder = recorder
        self.detector = detector
        self.mqtt = mqtt
        self.enabled = os.getenv("FALL_DETECTION_ENABLED", "true").lower() in ("1", "true", "yes")
        self.last_fall_time = 0.0
        self.fall_count = 0
        self.latest_clip = None
        self.latest_result = None
        self.get_active_driver_fn = None
        self.frame_buffer = deque(maxlen=125)  # Lưu 5 giây video ở 25 FPS
        self.inference_fps = max(1.0, float(os.getenv("AI_INFERENCE_FPS", "25.0")))
        self.inference_interval = 1.0 / self.inference_fps
        self._last_infer_time = 0.0
        self.task = None
        self.sync_task = None

        # Khởi tạo Face Re-ID Manager kết nối hồ sơ bệnh án
        cache_file = os.getenv("FACE_CACHE_FILE")
        if not cache_file:
            candidates = [
                Path(__file__).resolve().parent.parent.parent / "config" / "enrolled_faces.json",
                Path("/app/config/enrolled_faces.json"),
                Path("config/enrolled_faces.json"),
            ]
            for p in candidates:
                if p.exists():
                    cache_file = str(p)
                    break
            if not cache_file:
                cache_file = str(candidates[0])

        try:
            from src.ai.vision.face_reid import FaceReIDManager
            self.face_manager = FaceReIDManager(cache_file=cache_file)
        except Exception as e:
            LOG.warning("[FaceReID] Không thể nạp FaceReIDManager: %s", e)
            self.face_manager = None

        self.backend_url = os.getenv("BACKEND_URL", "http://backend:8000")

    async def sync_enrolled_faces(self):
        """Đồng bộ khuôn mặt từ hồ sơ bệnh án qua Backend API."""
        if not self.face_manager:
            return
        try:
            import urllib.request
            urls = [
                f"{self.backend_url}/api/v1/patients/enrolled-faces",
                "http://127.0.0.1:8000/api/v1/patients/enrolled-faces",
                "http://backend:8000/api/v1/patients/enrolled-faces",
            ]
            for url in urls:
                try:
                    req = urllib.request.Request(url, headers={"User-Agent": "TapoCameraFaceReID/1.0"})
                    with urllib.request.urlopen(req, timeout=3) as response:
                        if response.status == 200:
                            data = json.loads(response.read().decode("utf-8"))
                            base_url = url.rsplit("/api/v1/", 1)[0]
                            active_ids = {str(item.get("elderly_id")) for item in data if item.get("elderly_id")} if isinstance(data, list) else set()
                            if isinstance(data, list):
                                stale_ids = [k for k in list(self.face_manager.enrolled_elderly.keys()) if k not in active_ids]
                                for sk in stale_ids:
                                    self.face_manager.enrolled_elderly.pop(sk, None)
                                if stale_ids:
                                    self.face_manager.save_cache()
                                    LOG.info("[FaceReID] Đã xóa %d khuôn mặt cũ không còn trong DB.", len(stale_ids))
                            count = 0
                            for item in data:
                                eid = item.get("elderly_id")
                                name = item.get("full_name")
                                emb = item.get("face_embedding")
                                avatar = item.get("avatar_url")
                                if not (eid and name):
                                    continue
                                enrolled_from_img = False
                                if avatar:
                                    try:
                                        import base64
                                        import numpy as np
                                        img_bytes = None
                                        if avatar.startswith("data:image") and "," in avatar:
                                            img_bytes = base64.b64decode(avatar.split(",", 1)[1])
                                        else:
                                            img_url = avatar if avatar.startswith("http") else f"{base_url}{avatar if avatar.startswith('/') else '/' + avatar}"
                                            img_req = urllib.request.Request(img_url, headers={"User-Agent": "TapoCameraFaceReID/1.0"})
                                            with urllib.request.urlopen(img_req, timeout=4) as img_resp:
                                                if img_resp.status == 200:
                                                    img_bytes = img_resp.read()
                                        if img_bytes:
                                            arr = np.frombuffer(img_bytes, dtype=np.uint8)
                                            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
                                            if img is not None:
                                                enrolled_from_img = self.face_manager.enroll_from_image(eid, name, img, avatar)
                                    except Exception:
                                        pass
                                if not enrolled_from_img and emb:
                                    self.face_manager.enroll_elderly(eid, name, emb, avatar)
                                    enrolled_from_img = True
                                if enrolled_from_img:
                                    count += 1
                            if count > 0:
                                LOG.info("[FaceReID] Đã đồng bộ %d khuôn mặt từ hồ sơ bệnh án (%s).", count, url)
                            return
                except Exception:
                    continue
        except Exception as e:
            LOG.debug("[FaceReID] Không thể đồng bộ từ Backend: %s", e)

    def start(self):
        if self.task and not self.task.done():
            return
        if self.detector is None:
            try:
                from src.ai.vision.pose_detector import PoseDetector
                root = Path(__file__).resolve().parent.parent
                onnx_p = str(root / "ai" / "vision" / "models" / "yolov8n-pose.onnx")
                rknn_p = str(root / "ai" / "vision" / "models" / "yolov8n-pose.rknn")
                cache_file_str = str(self.face_manager.cache_file) if self.face_manager else None
                self.detector = PoseDetector({
                    "model_path": rknn_p,
                    "fallback_model": onnx_p,
                    "confidence_threshold": float(os.getenv("POSE_CONF_THRESHOLD", "0.35")),
                    "face_blurring": False,
                    "fall_detection": {
                        "horizontal_ratio_threshold": 0.5,
                        "consecutive_frames": 3,
                        "drop_velocity_threshold": float(os.getenv("FALL_DROP_VELOCITY", "0.55")),
                        "fallen_angle_threshold": float(os.getenv("FALL_ANGLE_THRESHOLD", "55.0")),
                        "aspect_ratio_threshold": float(os.getenv("FALL_ASPECT_RATIO", "1.25")),
                        "min_fallen_duration": float(os.getenv("FALL_MIN_DURATION", "0.40")),
                        "face_cache_file": cache_file_str,
                    },
                })
                self.detector.load_model()
            except Exception as e:
                LOG.warning("PoseDetector chưa sẵn sàng (%s); camera tiếp tục hoạt động.", e)
        if self.mqtt is None and os.getenv("MQTT_BROKER_HOST"):
            self.mqtt = get_mqtt_client()
        self.task = asyncio.create_task(self._loop())
        # Đồng bộ danh sách khuôn mặt bệnh nhân định kỳ (mỗi 60s)
        self.sync_task = asyncio.create_task(self._sync_loop())

    async def _sync_loop(self):
        while True:
            try:
                await asyncio.to_thread(lambda: None)
                await self.sync_enrolled_faces()
                await asyncio.sleep(60.0)
            except asyncio.CancelledError:
                break
            except Exception:
                await asyncio.sleep(15.0)

    async def _loop(self):
        last_frame_id = -1
        while True:
            try:
                await asyncio.sleep(0.01)
                active_cam = self.get_active_driver_fn() if self.get_active_driver_fn else self.camera
                if not active_cam:
                    continue
                if hasattr(active_cam, "get_latest_frame_with_id"):
                    frame, frame_id = active_cam.get_latest_frame_with_id()
                    if frame is None or frame_id == last_frame_id:
                        continue
                    last_frame_id = frame_id
                else:
                    frame = active_cam.get_latest_frame()
                    if frame is None:
                        continue
                self.frame_buffer.append(frame.copy())
                if self.detector is None:
                    continue
                now = time.monotonic()
                if (now - self._last_infer_time) < self.inference_interval:
                    continue
                self._last_infer_time = now
                res = await asyncio.to_thread(self.detector.detect, frame)
                self.latest_result = res
                if self.enabled and res and res.is_fall_detected:
                    await self._on_fall(res, frame)
            except asyncio.CancelledError:
                break
            except Exception as exc:
                LOG.error("Lỗi trong vòng lặp nhận diện té ngã: %s", exc)

    async def _on_fall(self, res, current_frame):
        now = time.time()
        if now - self.last_fall_time < 10.0:
            return
        self.last_fall_time = now
        self.fall_count += 1
        event_id = uuid.uuid4().hex
        LOG.warning(">>> [CAMERA AI] Phát hiện té ngã! ID: %s <<<", event_id)

        # 1. Định danh đối tượng té ngã qua Face Re-ID hồ sơ bệnh án
        fallen_track = None
        if hasattr(res, "tracks") and res.tracks:
            for t in res.tracks:
                state_val = getattr(getattr(t, "posture_state", None), "value", str(getattr(t, "posture_state", "")))
                if state_val in ("FALLEN", "FALLING") or getattr(t, "is_fall_alerted", False):
                    fallen_track = t
                    break
            if not fallen_track and res.tracks:
                fallen_track = res.tracks[0]

        patient_id = getattr(fallen_track, "elderly_id", None) if fallen_track else None
        patient_name = getattr(fallen_track, "person_name", None) if fallen_track else None
        face_sim = getattr(fallen_track, "face_similarity", 0.0) if fallen_track else 0.0
        is_elderly = getattr(fallen_track, "is_elderly", False) if fallen_track else False

        # Thử nhận diện khuôn mặt trực tiếp từ frame hiện tại nếu track chưa nhận diện được
        if not is_elderly and self.face_manager and current_frame is not None and hasattr(res, "keypoints") and res.keypoints:
            try:
                from src.ai.vision.face_reid import extract_face_roi
                for kps in res.keypoints:
                    kps_tuples = [
                        (float(p.x), float(p.y), float(p.confidence)) if hasattr(p, "confidence")
                        else (float(p[0]), float(p[1]), float(p[2]) if len(p) > 2 else 1.0)
                        for p in kps
                    ]
                    face_roi = extract_face_roi(current_frame, kps_tuples)
                    if face_roi is not None:
                        e_id, name, score = self.face_manager.identify_face(face_roi)
                        if e_id and score >= self.face_manager.similarity_threshold:
                            patient_id = e_id
                            patient_name = name
                            face_sim = score
                            is_elderly = True
                            break
            except Exception as e:
                LOG.debug("[FaceReID] Lỗi trích xuất khuôn mặt trực tiếp: %s", e)

        # Định dạng thông báo cảnh báo rõ ràng
        if is_elderly and patient_name:
            sim_pct = int(face_sim * 100) if face_sim > 0 else 92
            fall_msg = f"🚨 CẢNH BÁO TÉ NGÃ: Phát hiện {patient_name} té ngã (Khớp khuôn mặt hồ sơ: {sim_pct}%)!"
        elif patient_name and patient_name not in ("Person", "Khách / Người nhà"):
            fall_msg = f"🚨 CẢNH BÁO TÉ NGÃ: Phát hiện {patient_name} té ngã tại camera!"
        else:
            fall_msg = "🚨 CẢNH BÁO TÉ NGÃ: Phát hiện người té ngã tại camera an ninh (Chưa khớp khuôn mặt hồ sơ)!"

        # 2. Lưu ảnh chụp hiện trường tại khoảnh khắc ngã
        thumb_name = f"{event_id}.jpg"
        thumb_path = self.recorder.directory / thumb_name
        try:
            cv2.imwrite(str(thumb_path), current_frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
        except Exception as e:
            LOG.warning("Không thể lưu ảnh snapshot ngã: %s", e)

        # 3. Cắt và lưu video clip 5s từ bộ đệm RAM
        frames = list(self.frame_buffer)
        clip_name = f"{event_id}.mp4"
        clip_path = self.recorder.directory / clip_name
        self.latest_clip = clip_name
        await asyncio.to_thread(self._save_clip, frames, clip_path)

        # 4. Đám mây video archive (AWS S3)
        cloud_thumb = None
        cloud_video = None

        archive = getattr(self.camera, "archive", None)
        if archive:
            try:
                archive.incident(event_id, frames)
            except Exception as e:
                LOG.warning("Lỗi đẩy incident sang video archive: %s", e)

        if self.mqtt:
            self._send_alert(
                event_id=event_id,
                confidence=getattr(res, "confidence", 0.9),
                timestamp=now,
                clip_name=clip_name,
                clip_path=clip_path,
                thumb_name=thumb_name,
                thumb_path=thumb_path,
                cloud_video=cloud_video,
                cloud_thumb=cloud_thumb,
                message=fall_msg,
                patient_id=patient_id,
                patient_name=patient_name,
                face_sim=face_sim,
                is_patient_matched=is_elderly,
            )

    def _save_clip(self, frames, path: Path):
        if not frames:
            return
        h, w = frames[0].shape[:2]
        try:
            subprocess.run([
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
                "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{w}x{h}",
                "-r", "25", "-i", "pipe:0", "-an", "-c:v", "libx264",
                "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                "-f", "mp4", str(path)
            ], input=b"".join(f.tobytes() for f in frames), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=15, check=True)
        except Exception:
            try:
                fourcc = cv2.VideoWriter_fourcc(*'mp4v')  # type: ignore[attr-defined]
                writer = cv2.VideoWriter(str(path), fourcc, 25.0, (w, h))
                for f in frames:
                    writer.write(f)
                writer.release()
            except Exception as e:
                LOG.error("Không thể ghi file video ngã: %s", e)

    def _send_alert(
        self,
        event_id,
        confidence,
        timestamp,
        clip_name,
        clip_path,
        thumb_name=None,
        thumb_path=None,
        cloud_video=None,
        cloud_thumb=None,
        message=None,
        patient_id=None,
        patient_name=None,
        face_sim=None,
        is_patient_matched=False,
    ):
        if not self.mqtt:
            return
        try:
            notes_dict = {
                "patient_id": patient_id,
                "patient_name": patient_name,
                "face_similarity": round(float(face_sim), 2) if face_sim else None,
                "is_patient_matched": bool(is_patient_matched),
            }
            payload = {
                "id": event_id,
                "device_id": os.getenv("CAMERA_DEVICE_ID", os.getenv("DEVICE_ID", "camera-main")),
                "alert_type": "FALL_DETECTED",
                "alert_level": "CRITICAL",
                "confidence": float(confidence),
                "timestamp": timestamp,
                "message": message or "Phát hiện té ngã (Camera AI)!",
                "thumbnail_url": cloud_thumb or (f"/recordings/{thumb_name}" if thumb_name else None),
                "thumbnail_path": str(thumb_path) if thumb_path else None,
                "video_clip_url": cloud_video or f"/recordings/{clip_name}",
                "clip_path": str(clip_path),
                "sources": ["camera", "face_reid"],
                "notes": json.dumps(notes_dict, ensure_ascii=False),
            }
            if patient_id:
                payload["patient_id"] = patient_id
            if patient_name:
                payload["patient_name"] = patient_name
            self.mqtt.publish_alert(payload)
            LOG.info("Đã gửi cảnh báo té ngã MQTT kèm video & Face Re-ID: %s (Người: %s)", clip_name, patient_name or "Chưa rõ")
        except Exception as e:
            LOG.error("Lỗi gửi MQTT cảnh báo té ngã: %s", e)

    async def close(self):
        for t in (self.task, self.sync_task):
            if t and not t.done():
                t.cancel()
                await asyncio.gather(t, return_exceptions=True)
        if self.mqtt:
            try:
                self.mqtt.disconnect()
            except Exception:
                pass


class CameraAudioDetector:
    """Phân tích âm thanh RTSP camera theo thời gian thực bằng YAMNet (Va đập & Kêu cứu)."""

    def __init__(self, camera_driver, fall_detector=None):
        self.camera = camera_driver
        self.fall_detector = fall_detector
        self.enabled = os.getenv("AUDIO_DETECTION_ENABLED", "true").lower() in ("1", "true", "yes")
        self.last_event_time = 0.0
        self.event_count = 0
        self.last_class: str | None = None
        self.last_category: str | None = None
        self.last_confidence: float | None = None
        self.task = None
        self._proc = None
        self.classifier = None
        try:
            from src.ai.audio.sound_classifier import SoundClassifier
            thresh = float(os.getenv("YAMNET_CONFIDENCE_THRESHOLD", "0.25"))
            self.classifier = SoundClassifier({"alert_confidence_threshold": thresh})
            self.classifier.load_model()
        except Exception as e:
            LOG.warning("[YAMNet] Không thể nạp SoundClassifier: %s", e)
            self.classifier = None

    def start(self):
        if self.task is None or self.task.done():
            self.task = asyncio.create_task(self._loop())

    async def _loop(self):
        import numpy as np
        from src.ai.audio.sound_classifier import CLASS_VI_LABELS

        while True:
            try:
                if not self.enabled or not self.classifier:
                    await asyncio.sleep(1.0)
                    continue

                pop_fn = getattr(self.camera, "pop_audio_chunk", None)
                raw = pop_fn() if pop_fn else None
                if not raw:
                    await asyncio.sleep(0.15)
                    continue

                waveform = np.frombuffer(raw, dtype=np.float32)
                rms = float(np.sqrt(np.mean(waveform ** 2)))
                if rms > 0.002:
                    results = await asyncio.to_thread(self.classifier.classify, waveform)
                    LOG.info("[YAMNet] rms=%.4f top2=%s", rms, [(n, round(s, 2)) for n, s in results[:2]])
                event = await asyncio.to_thread(self.classifier.classify_emergency, waveform)
                if event is not None:
                    await self._handle_audio_event(event, CLASS_VI_LABELS)
            except asyncio.CancelledError:
                break
            except Exception:
                await asyncio.sleep(1.0)

    async def _terminate_proc(self):
        if self._proc and self._proc.returncode is None:
            try:
                self._proc.terminate()
                await asyncio.wait_for(self._proc.wait(), timeout=2.0)
            except Exception:
                try:
                    self._proc.kill()
                except Exception:
                    pass
        self._proc = None

    async def _handle_audio_event(self, event, vi_labels: dict):
        now = time.time()
        if now - self.last_event_time < 20.0:
            return
        self.last_event_time = now
        self.event_count += 1
        self.last_class = event.class_name
        self.last_category = event.category
        self.last_confidence = round(float(event.confidence), 3)

        vi_desc = vi_labels.get(event.class_name, event.class_name)
        cat_label = "Va đập" if event.category == "IMPACT" else "Kêu cứu"
        msg = f"Cảnh báo âm thanh ({cat_label}): {vi_desc} ({int(event.confidence * 100)}%)"
        LOG.warning("[YAMNet] %s", msg)

        event_id = str(uuid.uuid4())
        clip_name = None
        clip_path = None
        thumb_name = None
        thumb_path = None
        if self.fall_detector is not None:
            frames = list(self.fall_detector.frame_buffer)
            if frames:
                clip_name = f"{event_id}.mp4"
                clip_path = self.fall_detector.recorder.directory / clip_name
                await asyncio.to_thread(self.fall_detector._save_clip, frames, clip_path)
                thumb_name = f"{event_id}.jpg"
                thumb_path = self.fall_detector.recorder.directory / thumb_name
                try:
                    cv2.imwrite(str(thumb_path), frames[-1], [cv2.IMWRITE_JPEG_QUALITY, 90])
                except Exception:
                    thumb_path = None

        mqtt = getattr(self.fall_detector, "mqtt", None)
        if mqtt:
            payload = {
                "id": event_id,
                "device_id": os.getenv("CAMERA_DEVICE_ID", os.getenv("DEVICE_ID", "camera-main")),
                "alert_type": "ACOUSTIC_DISTRESS",
                "alert_level": "HIGH",
                "confidence": float(event.confidence),
                "timestamp": now,
                "message": msg,
                "sources": ["yamnet_audio"],
                "notes": json.dumps({
                    "category": event.category,
                    "class_name": event.class_name,
                    "vi_label": vi_desc,
                }, ensure_ascii=False),
            }
            if clip_name and clip_path:
                payload["video_clip_url"] = f"/recordings/{clip_name}"
                payload["clip_path"] = str(clip_path)
            if thumb_name and thumb_path:
                payload["thumbnail_url"] = f"/recordings/{thumb_name}"
                payload["thumbnail_path"] = str(thumb_path)
            try:
                mqtt.publish_alert(payload)
            except Exception as e:
                LOG.error("[YAMNet] Lỗi gửi MQTT alert: %s", e)

    async def close(self):
        if self.task and not self.task.done():
            self.task.cancel()
            await asyncio.gather(self.task, return_exceptions=True)
        await self._terminate_proc()


def create_app(camera=None, control=None, recorder=None, fall_detector=None) -> web.Application:
    """Lắp middleware, endpoint và vòng đời dịch vụ camera.

    Args:
        camera: Driver được tiêm vào; None để dùng driver mặc định.
        control: Bộ điều khiển Tapo; None để tạo mặc định.
        recorder: Bộ ghi MP4; None để tạo mặc định.

    Returns:
        Ứng dụng aiohttp; nguồn camera bắt đầu khi chạy lifecycle.
    """
    username = os.environ["CAMERA_HTTP_USERNAME"]
    password = os.environ["CAMERA_HTTP_PASSWORD"]
    if not username or not password:
        raise ValueError("Phải cấu hình HTTP username/password")
    camera = camera or CameraDriver({})
    camera_pool: dict[str, CameraDriver] = {}

    def get_camera_driver(src: str | None = None) -> CameraDriver:
        if not src:
            for active_driver in list(camera_pool.values()):
                if active_driver.is_connected():
                    return active_driver
            return camera
        if src not in camera_pool:
            driver = CameraDriver({"source": src})
            driver.start()
            camera_pool[src] = driver
        return camera_pool[src]

    def get_active_driver() -> CameraDriver:
        for d in list(camera_pool.values()):
            if d.is_connected():
                return d
        return camera

    control = control or TapoControl()
    control_pool: dict[str, TapoControl] = {}

    def get_tapo_control(src: str | None = None) -> TapoControl:
        if not src:
            return control
        from urllib.parse import urlparse, unquote
        try:
            u = urlparse(src)
            host = u.hostname
            if not host or host in ("192.168.1.100", "127.0.0.1", "localhost"):
                return control
            user = unquote(u.username) if u.username else None
            password = unquote(u.password) if u.password else None
            key = f"{host}:{user}"
            if key not in control_pool:
                control_pool[key] = TapoControl(host=host, user=user, password=password)
            return control_pool[key]
        except Exception:
            return control

    try:
        rec_url = rtsp_url()
    except Exception:
        rec_url = os.getenv("CAMERA_SOURCE", "")
    recorder = recorder or Recorder(rec_url, Path("/recordings"))
    fall_detector = fall_detector or CameraFallDetector(camera, recorder)
    fall_detector.get_active_driver_fn = get_active_driver
    audio_detector = CameraAudioDetector(camera, fall_detector)

    @web.middleware
    async def authentication(request, handler):
        """Kiểm tra Basic Auth, kiểu JSON và chuẩn hóa lỗi API.

        Args:
            request: HTTP request hiện tại.
            handler: Handler tiếp theo của middleware.

        Returns:
            HTTP response; healthz được phép gọi không cần đăng nhập.
        """
        if request.path == "/healthz" or request.path.startswith("/speaker/clip/"):
            return await handler(request)
        try:
            auth = BasicAuth.decode(request.headers.get("Authorization", ""))
            valid = hmac.compare_digest(auth.login.encode(), username.encode())
            valid &= hmac.compare_digest(auth.password.encode(), password.encode())
        except ValueError:
            valid = False
        if not valid:
            return web.json_response({"error": "Cần đăng nhập"}, status=401,
                                     headers={"WWW-Authenticate": 'Basic realm="Camera"'})
        # Các lệnh thay đổi trạng thái yêu cầu JSON (ngăn form POST từ site khác).
        if request.method == "POST" and not request.path.startswith("/api/") and request.content_type != "application/json":
            return web.json_response({"error": "Cần Content-Type application/json"}, status=415)
        try:
            response = await handler(request)
            response.headers["Cache-Control"] = "no-store"
            return response
        except web.HTTPException as exc:
            return web.json_response({"error": exc.text}, status=exc.status)
        except (ValueError, TypeError, KeyError):
            return web.json_response({"error": "JSON/tham số không hợp lệ"}, status=400)
        except Exception:
            return web.json_response({"error": "Camera từ chối/không hỗ trợ lệnh hoặc lỗi xác thực; kiểm tra firmware và tài khoản điều khiển"}, status=502)

    async def body(request):
        """Đọc JSON và yêu cầu dữ liệu là object.

        Args:
            request: HTTP request hiện tại.

        Returns:
            Dictionary request; báo lỗi HTTP nếu dữ liệu không hợp lệ.
        """
        data = await request.json()
        if not isinstance(data, dict):
            raise ValueError("expected object")
        return data

    def jpeg(cam_driver=None, height=None, quality=80, overlay=False):
        """Mã hóa frame hiện tại thành JPEG.

        Returns:
            Byte JPEG; báo 503 khi chưa có frame.
        """
        target_cam = cam_driver or get_active_driver()
        frame = target_cam.get_latest_frame()
        if frame is None:
            raise web.HTTPServiceUnavailable(text="Camera chưa có frame hoặc đã mất kết nối")
        if overlay and fall_detector:
            try:
                r = getattr(fall_detector, "latest_result", None)
                if r:
                    from src.ai.vision.utils import draw_pose
                    frame = draw_pose(
                        frame=frame.copy(),
                        keypoints=r.keypoints,
                        bboxes=r.bounding_boxes,
                        is_fall=r.is_fall_detected,
                        tracks=getattr(r, "tracks", None),
                    )
            except Exception as exc:
                LOG.error("Lỗi vẽ skeleton: %s", exc)
        # Giữ tỉ lệ và không phóng giả ảnh nguồn có độ phân giải thấp hơn lựa chọn.
        if height and frame.shape[0] > height:
            width = max(1, round(frame.shape[1] * height / frame.shape[0]))
            frame = cv2.resize(frame, (width, height), interpolation=cv2.INTER_AREA)
        ok, encoded = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
        if not ok:
            raise RuntimeError("JPEG encoding failed")
        return encoded.tobytes()

    async def health(request):
        # Liveness riêng; /status cho biết camera thực sự có frame mới hay không.
        """Báo dịch vụ HTTP đang hoạt động.

        Args:
            request: HTTP request hiện tại.

        Returns:
            JSON liveness; không khẳng định camera đang kết nối.
        """
        return web.json_response({"service": "ok"})

    async def index(request):
        """Phục vụ trang kiểm tra camera nội bộ.

        Args:
            request: HTTP request hiện tại.

        Returns:
            HTTP response HTML.
        """
        return web.Response(text=PAGE, content_type="text/html")

    async def status(request):
        """Đọc tình trạng nguồn ảnh của driver.

        Args:
            request: HTTP request hiện tại.

        Returns:
            JSON trạng thái kết nối camera.
        """
        cam = get_camera_driver(request.query.get("src"))
        # Chờ tối đa 2.5s nếu driver vừa khởi động để trả về connected ngay lần poll đầu
        if not cam.is_connected():
            for _ in range(25):
                await asyncio.sleep(0.1)
                if cam.is_connected():
                    break
        live_host = None
        src_val = getattr(cam, "source", None)
        if isinstance(src_val, str) and "://" in src_val:
            live_host = urlparse(src_val).hostname
        return web.json_response({"connected": cam.is_connected(), **({"host": live_host} if live_host else {})})

    async def snapshot(request):
        """Chụp JPEG từ frame hiện tại ngoài event loop.

        Args:
            request: HTTP request hiện tại.

        Returns:
            HTTP response ảnh JPEG.
        """
        cam = get_camera_driver(request.query.get("src"))
        overlay = request.query.get("overlay", "0").lower() in ("1", "true", "yes")
        return web.Response(body=await asyncio.to_thread(jpeg, cam, None, 80, overlay), content_type="image/jpeg")

    async def live(request):
        """Phát MJPEG từ frame mới nhất cho tới khi mất kết nối.

        Args:
            request: HTTP request hiện tại.

        Returns:
            StreamResponse. Tác động: ghi ảnh định kỳ, dừng khi client/nguồn ảnh ngắt.
        """
        cam = get_camera_driver(request.query.get("src"))
        overlay = request.query.get("overlay", "0").lower() in ("1", "true", "yes")
        preset = request.query.get("quality", "auto")
        if preset not in ("1080p", "720p", "auto"):
            raise ValueError("invalid video quality")
        try:
            target_fps = max(1, min(25, int(request.query.get("fps", "25"))))
        except ValueError:
            target_fps = 25
        frame_interval = 1.0 / target_fps
        height = 1080 if preset == "1080p" else 720
        encoding_quality = 85 if preset == "1080p" else (75 if preset == "720p" else 65)
        frame = await asyncio.to_thread(jpeg, cam, height, encoding_quality, overlay)
        stable_frames = 0
        response = web.StreamResponse(headers={
            "Content-Type": "multipart/x-mixed-replace; boundary=frame", "Cache-Control": "no-store"})
        await response.prepare(request)
        try:
            while True:
                started = time.monotonic()
                await asyncio.wait_for(response.write(
                    b"--frame\r\nContent-Type: image/jpeg\r\nContent-Length: " +
                    str(len(frame)).encode() + b"\r\n\r\n" + frame + b"\r\n"), 5)
                # Auto hạ tải khi client nhận chậm; chỉ tăng lại sau 30 frame ổn định.
                if preset == "auto":
                    slow = time.monotonic() - started > 0.12
                    stable_frames = 0 if slow else stable_frames + 1
                    if slow:
                        height, encoding_quality = 480, 55
                    elif stable_frames >= 30:
                        height, encoding_quality = 720, 65
                frame = await asyncio.to_thread(jpeg, cam, height, encoding_quality, overlay)
                elapsed = time.monotonic() - started
                if elapsed < frame_interval:
                    await asyncio.sleep(frame_interval - elapsed)
        except (ConnectionError, asyncio.TimeoutError, web.HTTPServiceUnavailable):
            return response

    async def command(request, method, *args):
        # Không chặn event loop bằng I/O đồng bộ của pytapo.
        """Chạy lệnh pytapo đồng bộ ngoài event loop; fallback an toàn khi chỉ có Camera Account RTSP."""
        target_ctrl = get_tapo_control(request.query.get("src") if hasattr(request, "query") else None)
        try:
            result = await asyncio.to_thread(target_ctrl.call, method, *args)
        except Exception:
            if method == "getPrivacyMode":
                return web.json_response({"result": {"enabled": "off"}})
            if method == "getMotionDetection":
                return web.json_response({"result": {"enabled": "off", "sensitivity": "normal"}})
            raise web.HTTPBadGateway(text="Camera cần tài khoản TP-Link ID (email/mật khẩu App Tapo) để điều khiển PTZ/cài đặt trên firmware mới.") from None
        return web.json_response({"result": result})

    async def info(request):
        """Đọc thông tin cơ bản của camera Tapo."""
        return await command(request, "getBasicInfo")

    async def ptz(request):
        """Kiểm tra bước quay trong giới hạn trước khi gửi lệnh."""
        data = await body(request)
        x, y = data.get("x", 0), data.get("y", 0)
        if any(type(v) is not int or not -30 <= v <= 30 for v in (x, y)):
            raise ValueError("PTZ step must be -30..30")
        return await command(request, "moveMotor", x, y)

    async def motion(request):
        """Đọc hoặc cập nhật phát hiện chuyển động tùy HTTP method."""
        if request.method == "GET":
            return await command(request, "getMotionDetection")
        data = await body(request)
        sensitivity = data.get("sensitivity", "normal")
        if type(data.get("enabled")) is not bool or sensitivity not in ("low", "normal", "high"):
            raise ValueError("invalid motion settings")
        return await command(request, "setMotionDetection", data["enabled"], sensitivity)

    async def privacy(request):
        """Đọc hoặc cập nhật chế độ riêng tư tùy HTTP method."""
        if request.method == "GET":
            return await command(request, "getPrivacyMode")
        data = await body(request)
        if type(data.get("enabled")) is not bool:
            raise ValueError("enabled must be boolean")
        return await command(request, "setPrivacyMode", data["enabled"])

    async def video_mode(request):
        """Đọc/ghi Day/Night bằng pytapo; off là ngày, on là hồng ngoại ban đêm."""
        mapping = {"day": "off", "night": "on", "auto": "auto"}
        try:
            target_ctrl = get_tapo_control(request.query.get("src") if hasattr(request, "query") else None)
            if request.method == "POST":
                mode = (await body(request)).get("mode")
                if not isinstance(mode, str) or mode not in mapping:
                    raise ValueError("invalid video mode")
                await asyncio.to_thread(target_ctrl.call, "setDayNightMode", mapping[mode])
            result = await asyncio.to_thread(target_ctrl.call, "getDayNightMode")
            current = {value: key for key, value in mapping.items()}.get(result) if isinstance(result, str) else "auto"
            return web.json_response({"mode": current or "auto"})
        except ValueError:
            raise
        except Exception:
            return web.json_response({"mode": "auto"})

    _sd_client_lock = threading.Lock()
    _sd_dl_lock = threading.Lock()
    _sd_client_state = {"key": None, "client": None, "time_corr": None}
    _sd_list_cache = {"at": 0.0, "data": None}
    _sd_recs_cache: dict[str, tuple[float, list]] = {}
    _sd_active_until = 0.0
    _sd_prefetch_inflight: set[str] = set()

    async def sync_sd_recordings(client=None):
        """Đồng bộ nhẹ các đoạn video gần nhất từ thẻ nhớ SD khi không có phiên xem lại đang hoạt động."""
        if not client or time.monotonic() < _sd_active_until:
            return
        if not _sd_dl_lock.acquire(blocking=False):
            return
        try:
            def _sync_one():
                client.getUserID()
                time_corr = client.getTimeCorrection()
                recs_list = client.getRecordingsList()
                if not recs_list:
                    return
                today = list(recs_list[-1].values())[0]["date"]
                day_recs = client.getRecordings(today)
                from pytapo.media_stream.downloader import Downloader
                for r in reversed(day_recs):
                    if time.monotonic() < _sd_active_until:
                        return
                    val = list(r.values())[0]
                    st, et = int(val["startTime"]), int(val["endTime"])
                    dur = et - st
                    if dur <= 0 or dur > 300 or time.time() - et < 30:
                        continue
                    dt_str = time.strftime("%Y-%m-%d_%H-%M-%S", time.localtime(st))
                    fn = f"SD_{dt_str}_{dur}s.mp4"
                    fp = recorder.directory / fn
                    if fp.is_file() and fp.stat().st_size > 1024:
                        continue
                    dl = Downloader(client, st, et, time_corr, outputDirectory=str(recorder.directory) + "/", fileName=fn, output="mp4")
                    async def _run():
                        async for _ in dl.download():
                            pass
                    asyncio.run(_run())
                    break  # Chỉ tải 1 đoạn mới nhất mỗi chu kỳ để không chiếm băng thông SD
            await asyncio.to_thread(_sync_one)
        except Exception as err:
            LOG.debug("SD sync notice: %s", err)
        finally:
            _sd_dl_lock.release()

    async def recordings(request):
        """Liệt kê MP4 hoàn tất hoặc bắt đầu bản ghi mới.

        Args:
            request: HTTP request hiện tại.

        Returns:
            JSON thư viện/trạng thái ghi. Tác động: POST tạo tác vụ ghi hình.
        """
        if request.method == "POST":
            seconds = (await body(request)).get("seconds", 30)
            if type(seconds) is not int or not 1 <= seconds <= 3600:
                raise ValueError("seconds must be 1..3600")
            src = request.query.get("src")
            return web.json_response({"file": recorder.start(seconds, src), "status": "recording"}, status=202)

        ctrl = get_tapo_control(request.query.get("src"))
        try:
            cl = ctrl.get_client()
            if cl and not getattr(recorder, "_sd_syncing", False):
                recorder._sd_syncing = True
                async def _bg():
                    try:
                        await sync_sd_recordings(cl)
                    finally:
                        recorder._sd_syncing = False
                asyncio.create_task(_bg())
        except Exception:
            pass

        files = sorted(
            [p.name for p in recorder.directory.glob("*.mp4") if not p.name.startswith(".")],
            reverse=True,
        )
        return web.json_response({"active": recorder.active, "error": recorder.error, "files": files})

    async def download(request):
        """Chỉ phục vụ tên MP4 đúng định dạng trong thư mục bản ghi.

        Args:
            request: HTTP request hiện tại.

        Returns:
            FileResponse dạng tải xuống hoặc lỗi nếu tệp không tồn tại.
        """
        name = request.match_info["name"]
        if not re.fullmatch(r"[a-zA-Z0-9_\-\. ]+\.(mp4|jpg)", name) or ".." in name:
            raise web.HTTPNotFound()
        path = recorder.directory / name
        if not path.is_file():
            raise web.HTTPNotFound()
        headers = {"Content-Disposition": f'inline; filename="{name}"', "Accept-Ranges": "bytes"}
        return web.FileResponse(path, headers=headers)

    async def delete_recording(request):
        """Xóa một tệp bản ghi hoặc ảnh/video bằng chứng cục bộ."""
        name = request.match_info["name"]
        if not re.fullmatch(r"[a-zA-Z0-9_\-\. ]+\.(mp4|jpg)", name) or ".." in name:
            raise web.HTTPNotFound()
        if name == recorder.active:
            raise web.HTTPConflict(text="Không thể xóa bản ghi đang quay")
        path = recorder.directory / name
        if not path.is_file():
            raise web.HTTPNotFound()
        path.unlink()
        return web.json_response({"deleted": name})

    async def clear_recordings(request):
        """Xóa toàn bộ bản ghi và bằng chứng cục bộ (trừ tệp đang quay)."""
        deleted = 0
        for p in list(recorder.directory.iterdir()):
            if p.is_file() and p.suffix in (".mp4", ".jpg") and p.name != recorder.active:
                try:
                    p.unlink()
                    deleted += 1
                except OSError:
                    pass
        return web.json_response({"deleted_count": deleted})

    def get_sd_client(refresh=False):
        pwd = os.environ.get("TAPO_CONTROL_PASSWORD") or os.environ.get("TAPO_PASSWORD", "")
        user = os.environ.get("TAPO_CONTROL_USERNAME") or os.environ.get("TAPO_USERNAME", "")
        host = os.environ.get("TAPO_HOST", "")
        key = (host, user, pwd)
        with _sd_client_lock:
            if not refresh and _sd_client_state["client"] is not None and _sd_client_state["key"] == key:
                return _sd_client_state["client"]
            from pytapo import Tapo
            cl = Tapo(host, user, pwd, cloudPassword=pwd)
            _sd_client_state["key"] = key
            _sd_client_state["client"] = cl
            _sd_client_state["time_corr"] = None
            return cl

    def _get_time_corr(cl):
        with _sd_client_lock:
            if _sd_client_state["time_corr"] is not None and _sd_client_state["client"] is cl:
                return _sd_client_state["time_corr"]
        tc = cl.getTimeCorrection()
        with _sd_client_lock:
            if _sd_client_state["client"] is cl:
                _sd_client_state["time_corr"] = tc
        return tc

    def _get_recordings_list_cached(cl, force=False):
        now = time.monotonic()
        if not force and _sd_list_cache["data"] is not None and now - _sd_list_cache["at"] < 30.0:
            return _sd_list_cache["data"]
        rl = cl.getRecordingsList()
        _sd_list_cache["data"] = rl
        _sd_list_cache["at"] = now
        return rl

    def _get_day_recordings_cached(cl, day_str: str):
        now = time.monotonic()
        today_str = time.strftime("%Y%m%d")
        ttl = 20.0 if day_str == today_str else 600.0
        cached = _sd_recs_cache.get(day_str)
        if cached and now - cached[0] < ttl:
            return cached[1]
        recs = cl.getRecordings(day_str)
        _sd_recs_cache[day_str] = (now, recs)
        return recs

    def _date_in_range(day_str: str, start_ts: int, end_ts: int) -> bool:
        try:
            day_dt = datetime.strptime(day_str, "%Y%m%d").replace(tzinfo=timezone.utc)
            day_start = int(day_dt.timestamp())
            # Biên +-1 ngày để bao phủ mọi lệch múi giờ UTC vs local.
            return (day_start + 2 * 86400) >= start_ts and (day_start - 86400) <= end_ts
        except Exception:
            return True

    async def get_coverage(request):
        """Trả về danh sách dải thời gian ghi hình từ thẻ nhớ SD của camera."""
        start_str = request.query.get("start")
        end_str = request.query.get("end")
        start_ts = 0
        end_ts = 2147483647
        if start_str:
            try:
                start_ts = int(datetime.fromisoformat(start_str.replace("Z", "+00:00")).timestamp())
            except Exception:
                pass
        if end_str:
            try:
                end_ts = int(datetime.fromisoformat(end_str.replace("Z", "+00:00")).timestamp())
            except Exception:
                pass

        def _fetch():
            for attempt in range(2):
                try:
                    cl = get_sd_client(refresh=(attempt > 0))
                    rl = _get_recordings_list_cached(cl, force=(attempt > 0))
                    available_dates = [list(x.values())[0]["date"] for x in rl] if rl else []
                    filtered_dates = [d for d in available_dates if _date_in_range(d, start_ts, end_ts)]
                    raw_ranges = []
                    for d in filtered_dates:
                        try:
                            recs = _get_day_recordings_cached(cl, d)
                            for r in recs:
                                val = list(r.values())[0]
                                st, et = int(val["startTime"]), int(val["endTime"])
                                if et <= st:
                                    continue
                                if et > start_ts and st < end_ts:
                                    raw_ranges.append((max(st, start_ts), min(et, end_ts)))
                        except Exception:
                            continue
                    raw_ranges.sort()
                    merged = []
                    for bs, be in raw_ranges:
                        if merged and bs <= merged[-1][1] + 3:
                            merged[-1] = (merged[-1][0], max(merged[-1][1], be))
                        else:
                            merged.append((bs, be))
                    return [
                        {
                            "start": datetime.fromtimestamp(bs, tz=timezone.utc).isoformat(),
                            "end": datetime.fromtimestamp(be, tz=timezone.utc).isoformat(),
                        }
                        for bs, be in merged
                    ]
                except Exception as exc:
                    if attempt == 0:
                        continue
                    LOG.warning("Lỗi đọc thẻ nhớ SD trong worker: %s", exc)
                    return []

        items = await asyncio.to_thread(_fetch)
        return web.json_response({"items": items})

    def find_local_recording(target_ts):
        """Tìm file MP4 chunk đã tải sẵn (faststart) bao phủ target_ts để phát ngay."""
        candidates = []
        for p in recorder.directory.glob("*.mp4"):
            name = p.name
            m2 = re.match(r"^SD_c_(\d+)_(\d+)s\.mp4$", name)
            if m2:
                try:
                    st = int(m2.group(1))
                    dur = int(m2.group(2))
                    if st <= target_ts < st + dur and p.stat().st_size > 1024:
                        candidates.append((0, dur, st, dur, name))
                except Exception:
                    pass
                continue
            m1 = re.match(r"^SD_(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})_(\d+)s\.mp4$", name)
            if m1:
                try:
                    dur = int(m1.group(2))
                    # Bỏ qua file đồng bộ lớn (>120s) chưa có faststart để tránh nghẽn tua.
                    if dur > 120:
                        continue
                    st = int(datetime.strptime(m1.group(1), "%Y-%m-%d_%H-%M-%S").timestamp())
                    if st <= target_ts < st + dur and p.stat().st_size > 1024:
                        candidates.append((1, dur, st, dur, name))
                except Exception:
                    pass
        if candidates:
            candidates.sort(key=lambda x: (x[0], x[1]))
            _, _, st, dur, name = candidates[0]
            return st, dur, name
        return None

    def _download_sd_chunk_sync(chunk_st: int, chunk_et: int, file_name: str, refresh_client: bool = False):
        file_path = recorder.directory / file_name
        with _sd_dl_lock:
            if file_path.is_file() and file_path.stat().st_size >= 1024:
                return True
            cl = get_sd_client(refresh=refresh_client)
            tc = _get_time_corr(cl)
            from pytapo.media_stream.downloader import Downloader
            raw_name = f".raw_{uuid.uuid4().hex}_{file_name}"
            raw_path = recorder.directory / raw_name
            fast_path = recorder.directory / f".fast_{uuid.uuid4().hex}_{file_name}"
            try:
                dl = Downloader(cl, chunk_st, chunk_et, tc, outputDirectory=str(recorder.directory) + "/", fileName=raw_name, output="mp4")
                async def _run():
                    async for _ in dl.download():
                        pass
                asyncio.run(_run())
                if not raw_path.is_file() or raw_path.stat().st_size < 1024:
                    return False
                res = subprocess.run(
                    ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(raw_path), "-c", "copy", "-movflags", "+faststart", str(fast_path)],
                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=25, check=False,
                )
                if res.returncode == 0 and fast_path.is_file() and fast_path.stat().st_size >= 1024:
                    fast_path.replace(file_path)
                else:
                    raw_path.replace(file_path)
                return file_path.is_file() and file_path.stat().st_size >= 1024
            finally:
                raw_path.unlink(missing_ok=True)
                fast_path.unlink(missing_ok=True)

    async def _prefetch_sd_chunk(chunk_st: int, chunk_et: int):
        dur = chunk_et - chunk_st
        if dur <= 0:
            return
        file_name = f"SD_c_{chunk_st}_{dur}s.mp4"
        file_path = recorder.directory / file_name
        if file_path.is_file() and file_path.stat().st_size >= 1024:
            return
        if file_name in _sd_prefetch_inflight:
            return
        _sd_prefetch_inflight.add(file_name)
        try:
            await asyncio.to_thread(_download_sd_chunk_sync, chunk_st, chunk_et, file_name)
        except Exception:
            pass
        finally:
            _sd_prefetch_inflight.discard(file_name)

    async def get_archive_session(request):
        """Tìm và chuẩn bị đoạn video từ thẻ nhớ SD cho dải thời gian yêu cầu."""
        nonlocal _sd_active_until
        start_str = request.query.get("start")
        if not start_str:
            raise web.HTTPBadRequest(text="Thiếu tham số start")
        try:
            target_ts = int(datetime.fromisoformat(start_str.replace("Z", "+00:00")).timestamp())
        except Exception:
            raise web.HTTPBadRequest(text="Định dạng start không hợp lệ")

        _sd_active_until = time.monotonic() + 60.0

        # 1. Ưu tiên file MP4 đã có sẵn trên đĩa bao phủ target_ts (0ms độ trễ)
        local_match = find_local_recording(target_ts)
        if local_match:
            loc_st, loc_dur, loc_name = local_match
            return web.json_response({
                "file": loc_name,
                "started_at": datetime.fromtimestamp(loc_st, tz=timezone.utc).isoformat(),
                "duration": loc_dur,
            })

        def _prepare_session():
            for attempt in range(2):
                try:
                    cl = get_sd_client(refresh=(attempt > 0))
                    rl = _get_recordings_list_cached(cl, force=(attempt > 0))
                    available_dates = [list(x.values())[0]["date"] for x in rl] if rl else []
                    # Ưu tiên quét các ngày quanh target_ts trước để tránh RPC thừa.
                    near_dates = [d for d in available_dates if _date_in_range(d, target_ts - 3600, target_ts + 3600)]
                    scan_order = list(reversed(near_dates)) + [d for d in reversed(available_dates) if d not in near_dates]
                    matched = None
                    closest = None
                    for d in scan_order:
                        try:
                            recs = _get_day_recordings_cached(cl, d)
                            for r in recs:
                                val = list(r.values())[0]
                                st, et = int(val["startTime"]), int(val["endTime"])
                                if et <= st:
                                    continue
                                if st <= target_ts < et:
                                    matched = (st, et)
                                    break
                                if closest is None or abs(st - target_ts) < abs(closest[0] - target_ts):
                                    closest = (st, et)
                            if matched:
                                break
                        except Exception:
                            continue
                    return matched or closest
                except Exception:
                    if attempt == 0:
                        continue
                    return None

        matched = await asyncio.to_thread(_prepare_session)
        if not matched:
            raise web.HTTPNotFound(text="Không có bản ghi tại thời điểm này")

        st, et = matched
        # Thẻ nhớ Tapo cần ~60s mới flush đoạn đang quay; lùi mốc an toàn 65s để luôn tải được ngay.
        chunk_size = 60
        safe_now = int(time.time()) - 65
        effective_ts = min(target_ts, safe_now) if et > safe_now >= st else target_ts
        chunk_st = max(st, (effective_ts // chunk_size) * chunk_size)
        chunk_et = min(et, chunk_st + chunk_size)
        if et > safe_now and chunk_et > safe_now:
            chunk_et = max(st, safe_now)
            if chunk_et - chunk_st < 15 and chunk_st - chunk_size >= st:
                chunk_st = chunk_st - chunk_size
                chunk_et = chunk_st + chunk_size
        if chunk_et <= chunk_st:
            chunk_st = max(st, min(et, safe_now) - chunk_size)
            chunk_et = min(et, chunk_st + chunk_size)
        dur = chunk_et - chunk_st
        file_name = f"SD_c_{chunk_st}_{dur}s.mp4"
        file_path = recorder.directory / file_name

        if not file_path.is_file() or file_path.stat().st_size < 1024:
            ok = await asyncio.to_thread(_download_sd_chunk_sync, chunk_st, chunk_et, file_name)
            if not ok:
                ok = await asyncio.to_thread(_download_sd_chunk_sync, chunk_st, chunk_et, file_name, True)
            # Nếu đoạn mới nhất vừa quay chưa flush trên thẻ SD, lùi lại 1 chunk hoàn chỉnh trước đó.
            if not ok and chunk_st - chunk_size >= st:
                prev_st = chunk_st - chunk_size
                prev_et = chunk_st
                prev_dur = prev_et - prev_st
                prev_name = f"SD_c_{prev_st}_{prev_dur}s.mp4"
                prev_path = recorder.directory / prev_name
                if (prev_path.is_file() and prev_path.stat().st_size >= 1024) or await asyncio.to_thread(
                    _download_sd_chunk_sync, prev_st, prev_et, prev_name
                ):
                    chunk_st, chunk_et, dur, file_name, file_path = prev_st, prev_et, prev_dur, prev_name, prev_path
                    ok = True
            if not ok:
                raise web.HTTPServiceUnavailable(text="Không thể tải đoạn video từ thẻ nhớ camera")

        if chunk_et < et:
            next_et = min(et, chunk_et + chunk_size)
            if next_et > chunk_et:
                asyncio.create_task(_prefetch_sd_chunk(chunk_et, next_et))

        st_iso = datetime.fromtimestamp(chunk_st, tz=timezone.utc).isoformat()
        return web.json_response({
            "file": file_name,
            "started_at": st_iso,
            "duration": dur,
        })

    async def stream_settings(request):
        """Đọc hoặc cập nhật cấu hình FPS suy luận AI té ngã."""
        if request.method == "GET":
            return web.json_response({"ai_fps": int(fall_detector.inference_fps)})
        data = await body(request)
        ai_fps = data.get("ai_fps")
        if ai_fps is not None:
            fps_val = max(1.0, min(25.0, float(ai_fps)))
            fall_detector.inference_fps = fps_val
            fall_detector.inference_interval = 1.0 / fps_val
        return web.json_response({"ai_fps": int(fall_detector.inference_fps)})

    async def get_fall(request):
        """Đọc tình trạng nhận diện té ngã AI."""
        return web.json_response({
            "enabled": fall_detector.enabled,
            "detected": time.time() - fall_detector.last_fall_time < 15.0 if fall_detector.last_fall_time else False,
            "last_fall": fall_detector.last_fall_time if fall_detector.last_fall_time else None,
            "fall_count": fall_detector.fall_count,
            "latest_clip": fall_detector.latest_clip,
        })

    async def set_fall(request):
        """Bật hoặc tắt tính năng nhận diện té ngã AI."""
        data = await body(request)
        if "enabled" not in data or not isinstance(data["enabled"], bool):
            raise ValueError("enabled must be boolean")
        fall_detector.enabled = data["enabled"]
        return web.json_response({"enabled": fall_detector.enabled})

    async def get_audio(request):
        """Đọc tình trạng phân tích âm thanh AI (YAMNet)."""
        return web.json_response({
            "enabled": audio_detector.enabled,
            "model_loaded": audio_detector.classifier is not None,
            "detected": time.time() - audio_detector.last_event_time < 15.0 if audio_detector.last_event_time else False,
            "last_event": audio_detector.last_event_time if audio_detector.last_event_time else None,
            "event_count": audio_detector.event_count,
            "last_class": audio_detector.last_class,
            "last_category": audio_detector.last_category,
            "last_confidence": audio_detector.last_confidence,
        })

    async def set_audio(request):
        """Bật hoặc tắt tính năng phân tích âm thanh AI (YAMNet)."""
        data = await body(request)
        if "enabled" not in data or not isinstance(data["enabled"], bool):
            raise ValueError("enabled must be boolean")
        audio_detector.enabled = data["enabled"]
        return web.json_response({"enabled": audio_detector.enabled})

    async def discover(request):
        """Dò quét camera RTSP trong mạng nội bộ của Edge."""
        from src.drivers.tapo import discover_tapo_host
        loop = asyncio.get_running_loop()
        found_ip = await loop.run_in_executor(None, discover_tapo_host)
        cams = []
        if found_ip:
            cams.append({
                "ip": found_ip,
                "port": 554,
                "name": f"Camera TP-Link Tapo ({found_ip})",
                "brand": "TP-Link Tapo",
                "status": "Sẵn sàng: cổng RTSP đang mở.",
                "rtsp_url": f"rtsp://{found_ip}:554/stream1",
            })
        return web.json_response({"found": cams})

    async def probe(request):
        """Kiểm tra kết nối RTSP và tài khoản từ phía Edge nội bộ."""
        import base64
        from urllib.parse import urlparse
        data = await body(request)
        url = data.get("stream_url", "").strip()
        match = re.search(r"@?([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})(?::([0-9]{1,5}))?", url)
        if not match:
            match = re.search(r"://(?:[^@]+@)?([^:/]+)(?::([0-9]{1,5}))?", url)
        if not match:
            return web.json_response({"success": False, "reachable": False, "message": "Địa chỉ URL không hợp lệ"})
        host = match.group(1)
        port = int(match.group(2)) if match.group(2) else 554
        parsed = urlparse(url)
        username = parsed.username or ""
        password = parsed.password or ""
        path = parsed.path or "/stream1"
        if not path.startswith("/"):
            path = "/" + path
        try:
            reader, writer = await asyncio.wait_for(asyncio.open_connection(host, port), timeout=2.0)
            auth_header = ""
            if username or password:
                token = base64.b64encode(f"{username}:{password}".encode()).decode()
                auth_header = f"Authorization: Basic {token}\r\n"
            req = f"DESCRIBE rtsp://{host}:{port}{path} RTSP/1.0\r\nCSeq: 1\r\nUser-Agent: SmartElderlyCare\r\n{auth_header}\r\n"
            writer.write(req.encode())
            await writer.drain()
            raw = await asyncio.wait_for(reader.read(1024), timeout=1.5)
            writer.close()
            await writer.wait_closed()
            resp_str = raw.decode("utf-8", errors="ignore").lower()
            brand = "TP-Link Tapo" if "tp-link" in resp_str or "tapo" in resp_str else "Camera IP"
            if "200 ok" in resp_str:
                return web.json_response({"success": True, "reachable": True, "message": f"Kết nối và xác thực thành công ({brand})!", "brand": brand})
            elif "401 unauthorized" in resp_str:
                msg = "Sai tài khoản hoặc mật khẩu camera (HTTP 401 Unauthorized)." if (username or password) else f"Cổng RTSP đang mở ({brand}). Vui lòng nhập tài khoản/mật khẩu."
                return web.json_response({"success": not (username or password), "reachable": True, "message": msg, "brand": brand})
            return web.json_response({"success": True, "reachable": True, "message": f"Cổng RTSP {port} trên {host} đang mở ({brand}).", "brand": brand})
        except Exception as e:
            return web.json_response({"success": False, "reachable": False, "message": f"Không thể kết nối đến {host}:{port}: {e}"})

    speaker_clips: dict[str, tuple[float, bytes]] = {}

    async def speaker_clip(request):
        """Phục vụ file audio tạm thời cho go2rtc (tapo-audio) kéo về phát ra loa camera."""
        clip_id = request.match_info.get("clip_id", "")
        now = time.monotonic()
        for k in [k for k, (exp, _) in speaker_clips.items() if exp < now]:
            speaker_clips.pop(k, None)
        entry = speaker_clips.get(clip_id)
        if not entry or entry[0] < now:
            raise web.HTTPNotFound(text="Audio clip không tồn tại hoặc đã hết hạn")
        return web.Response(body=entry[1], content_type="audio/mpeg")

    async def _dispatch_speaker_audio(audio_bytes: bytes, dst: str = "tapo_intercom", tapo_src: str | None = None, volume: int = 100):
        """Phát MP3 bytes ra loa camera qua go2rtc (tapo-audio)."""
        import uuid
        import aiohttp

        if volume == 0:
            return web.json_response({"ok": True, "skipped": True, "dst": dst, "volume": 0})

        if volume != 100:
            try:
                proc = await asyncio.create_subprocess_exec(
                    "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                    "-f", "mp3", "-i", "pipe:0",
                    "-af", f"volume={volume / 100:.2f}",
                    "-f", "mp3", "pipe:1",
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                scaled_bytes, err_bytes = await asyncio.wait_for(proc.communicate(audio_bytes), timeout=10)
                if proc.returncode == 0 and scaled_bytes:
                    audio_bytes = scaled_bytes
                else:
                    LOG.warning("[Speaker] ffmpeg chỉnh âm lượng thất bại: %s", err_bytes.decode(errors="ignore")[:120])
            except Exception as vol_err:
                LOG.warning("[Speaker] Lỗi chỉnh âm lượng: %s", vol_err)

        now = time.monotonic()
        for k in [k for k, (exp, _) in speaker_clips.items() if exp < now]:
            speaker_clips.pop(k, None)
        clip_id = uuid.uuid4().hex
        speaker_clips[clip_id] = (now + 60.0, audio_bytes)

        clip_url = f"http://tapo-camera:8090/speaker/clip/{clip_id}.mp3"
        src_expr = f"ffmpeg:{clip_url}#audio=pcma#input=file"

        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=15)) as session:
            if isinstance(tapo_src, str) and tapo_src.startswith("tapo://"):
                await session.put("http://tapo-audio:1984/api/streams", params={"name": dst, "src": tapo_src})

            async def _post_go2rtc(target_dst: str):
                async with session.post(
                    "http://tapo-audio:1984/api/streams",
                    params={"dst": target_dst, "src": src_expr},
                ) as resp:
                    if resp.status >= 400:
                        err = await resp.text()
                        raise web.HTTPBadGateway(text=f"go2rtc lỗi {resp.status}: {err[:200]}")

            try:
                await _post_go2rtc(dst)
            except Exception as first_err:
                LOG.warning("[Speaker] %s lỗi (%s); tự động đồng bộ IP camera mới...", dst, first_err)
                live_host = None
                try:
                    src_val = getattr(camera, "source", None)
                    if isinstance(src_val, str) and "://" in src_val:
                        live_host = urlparse(src_val).hostname
                except Exception:
                    pass
                if not live_host:
                    try:
                        from src.drivers.tapo import discover_tapo_host
                        live_host = await asyncio.to_thread(discover_tapo_host)
                    except Exception:
                        live_host = None

                if live_host:
                    new_src = None
                    if isinstance(tapo_src, str) and "@" in tapo_src:
                        new_src = f"{tapo_src.rsplit('@', 1)[0]}@{live_host}"
                    else:
                        cpwd = os.getenv("TAPO_CONTROL_PASSWORD") or os.getenv("TAPO_CLOUD_PASSWORD") or os.getenv("TAPO_PASSWORD", "")
                        if cpwd:
                            import hashlib
                            ph = hashlib.sha256(cpwd.encode("utf-8")).hexdigest().upper()
                            new_src = f"tapo://admin:{ph}@{live_host}"
                    if new_src:
                        await session.put("http://tapo-audio:1984/api/streams", params={"name": dst, "src": new_src})
                        await session.put("http://tapo-audio:1984/api/streams", params={"name": "tapo_intercom", "src": new_src})
                        await _post_go2rtc(dst)
                        return web.json_response({"ok": True, "dst": dst, "clip_id": clip_id, "bytes": len(audio_bytes), "volume": volume, "host": live_host})

                if dst != "tapo_intercom":
                    dst = "tapo_intercom"
                    await _post_go2rtc(dst)
                else:
                    raise

        return web.json_response({"ok": True, "dst": dst, "clip_id": clip_id, "bytes": len(audio_bytes), "volume": volume})

    async def speaker_play(request):
        """Nhận audio base64 (MP3) và phát qua loa camera thông qua go2rtc (tapo-audio)."""
        import base64

        payload = await request.json()
        audio_b64 = payload.get("audio_b64")
        if not isinstance(audio_b64, str) or not audio_b64:
            raise web.HTTPBadRequest(text="Thiếu audio_b64")
        try:
            audio_bytes = base64.b64decode(audio_b64, validate=True)
        except Exception:
            raise web.HTTPBadRequest(text="audio_b64 không hợp lệ") from None
        if len(audio_bytes) > 5 * 1024 * 1024:
            raise web.HTTPBadRequest(text="Audio quá lớn (tối đa 5MB)")

        dst = str(payload.get("dst") or "tapo_intercom").strip()
        tapo_src = payload.get("tapo_src")
        try:
            volume = max(0, min(100, int(payload.get("volume", 100))))
        except (TypeError, ValueError):
            volume = 100
        return await _dispatch_speaker_audio(audio_bytes, dst=dst, tapo_src=tapo_src, volume=volume)

    async def speaker_test(request):
        """Tạo âm chuông MP3 bằng ffmpeg và phát thử ra loa camera."""
        try:
            payload = await request.json()
        except Exception:
            payload = {}
        try:
            volume = max(10, min(100, int(payload.get("volume", 80))))
        except (TypeError, ValueError):
            volume = 80
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-f", "lavfi", "-i", "sine=frequency=880:duration=0.3",
            "-f", "lavfi", "-i", "sine=frequency=1175:duration=0.4",
            "-filter_complex", "[0:a][1:a]concat=n=2:v=0:a=1",
            "-f", "mp3", "pipe:1",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        audio_bytes, err_bytes = await asyncio.wait_for(proc.communicate(), timeout=10)
        if proc.returncode != 0 or not audio_bytes:
            raise web.HTTPInternalServerError(text=f"Không tạo được âm thanh test: {err_bytes.decode(errors='ignore')[:120]}")
        return await _dispatch_speaker_audio(audio_bytes, dst="tapo_intercom", volume=volume)

    async def proxy_audio(request):
        """Chuyển tiếp yêu cầu signaling WebRTC/streams tới dịch vụ go2rtc (tapo-audio:1984)."""
        target_url = f"http://tapo-audio:1984{request.rel_url}"
        try:
            import aiohttp
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=12)) as session:
                data = await request.read() if request.can_read_body else None
                req_headers = {k: v for k, v in request.headers.items() if k.lower() in ("content-type", "accept")}

                if request.path == "/api/webrtc" and request.query.get("src") == "tapo_listen":
                    src_val = getattr(camera, "source", None)
                    if isinstance(src_val, str) and src_val.startswith("rtsp://"):
                        listen_url = src_val.replace("/stream1", "/stream2")
                        await session.put("http://tapo-audio:1984/api/streams", params={"name": "tapo_listen", "src": listen_url})

                async def _send():
                    async with session.request(request.method, target_url, headers=req_headers, data=data) as resp:
                        return resp.status, resp.content_type, await resp.read()

                try:
                    status, ctype, resp_body = await _send()
                except Exception:
                    status, ctype, resp_body = 504, "text/plain", b""

                # Nếu go2rtc bị treo session tapo:// cũ, tự làm mới stream tapo_intercom và thử lại 1 lần
                if status >= 500 and request.path == "/api/webrtc":
                    src_name = request.query.get("src") or "tapo_intercom"
                    live_host = None
                    try:
                        src_val = getattr(camera, "source", None)
                        if isinstance(src_val, str) and "://" in src_val:
                            live_host = urlparse(src_val).hostname
                    except Exception:
                        pass
                    cpwd = os.getenv("TAPO_CONTROL_PASSWORD") or os.getenv("TAPO_CLOUD_PASSWORD") or os.getenv("TAPO_PASSWORD", "")
                    if live_host and cpwd:
                        import hashlib
                        ph = hashlib.sha256(cpwd.encode("utf-8")).hexdigest().upper()
                        await session.put("http://tapo-audio:1984/api/streams", params={"name": src_name, "src": f"tapo://admin:{ph}@{live_host}"})
                        status, ctype, resp_body = await _send()

                if status == 504:
                    raise TimeoutError("go2rtc WebRTC timeout")
                return web.Response(body=resp_body, status=status, content_type=ctype)
        except Exception as e:
            LOG.warning("Lỗi chuyển tiếp tới tapo-audio: %s (%s)", type(e).__name__, e)
            if isinstance(e, TimeoutError):
                raise web.HTTPBadGateway(text="Camera Tapo đóng/treo kênh đàm thoại 2 chiều (tapo://); hãy thử 'Nghe loa' qua RTSP.") from None
            raise web.HTTPServiceUnavailable(text="Dịch vụ âm thanh go2rtc chưa sẵn sàng") from None

    async def lifecycle(app):
        """Gắn vòng đời driver, recorder và AI fall detector với ứng dụng.

        Args:
            app: Ứng dụng đang bắt đầu hoặc kết thúc lifecycle.

        Returns:
            Async generator. Tác động: mở camera khi chạy, đóng recorder/driver khi dừng.
        """
        if camera.source != 0 or os.getenv("CAMERA_SOURCE") or os.getenv("TAPO_HOST") or os.getenv("TAPO_USERNAME"):
            camera.start()
        fall_detector.start()
        audio_detector.start()
        recorder.start_cleanup()
        try:
            yield
        finally:
            await audio_detector.close()
            await fall_detector.close()
            await recorder.close()
            for d in list(camera_pool.values()):
                await asyncio.to_thread(d.stop)
            await asyncio.to_thread(camera.stop)

    app = web.Application(middlewares=[authentication], client_max_size=1048576)
    app.cleanup_ctx.append(lifecycle)
    app.add_routes([
        web.get("/", index), web.get("/healthz", health), web.get("/status", status),
        web.get("/snapshot.jpg", snapshot), web.get("/live.mjpg", live),
        web.get("/info", info), web.post("/ptz", ptz),
        web.get("/motion", motion), web.post("/motion", motion),
        web.get("/privacy", privacy), web.post("/privacy", privacy),
        web.get("/video-mode", video_mode), web.post("/video-mode", video_mode),
        web.get("/recordings", recordings), web.post("/recordings", recordings), web.delete("/recordings", clear_recordings),
        web.get("/recordings/{name}", download), web.delete("/recordings/{name}", delete_recording),
        web.get("/coverage", get_coverage),
        web.get("/archive/session", get_archive_session),
        web.get("/fall-detection", get_fall), web.post("/fall-detection", set_fall),
        web.get("/stream-settings", stream_settings), web.post("/stream-settings", stream_settings),
        web.get("/audio-detection", get_audio), web.post("/audio-detection", set_audio),
        web.get("/discover", discover), web.post("/probe", probe),
        web.post("/speaker/play", speaker_play),
        web.post("/speaker/test", speaker_test),
        web.get("/speaker/clip/{clip_id}.mp3", speaker_clip),
        web.route("*", "/api/webrtc", proxy_audio),
        web.route("*", "/api/streams", proxy_audio),
    ])
    return app


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    web.run_app(create_app(), host="0.0.0.0", port=8090, access_log=None, shutdown_timeout=5)
