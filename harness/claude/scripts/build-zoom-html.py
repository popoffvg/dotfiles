#!/usr/bin/env python3
import sys, pathlib

svg_path = sys.argv[1]
html_path = sys.argv[2]
title = sys.argv[3]

svg = pathlib.Path(svg_path).read_text()
i = svg.find('<svg')
svg = svg[i:]

html = '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>''' + title + '''</title>
<style>
html,body{margin:0;height:100%;background:#0a0a0a;color:#e5e7eb;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
#toolbar{position:fixed;top:8px;left:8px;z-index:10;background:rgba(0,0,0,0.6);padding:6px 10px;border-radius:6px;font-size:12px}
#toolbar button{background:#262626;color:#e5e7eb;border:1px solid #444;border-radius:4px;padding:2px 8px;margin-right:4px;cursor:pointer}
#toolbar button:hover{background:#333}
#stage{width:100vw;height:100vh}
#stage svg{width:100%;height:100%;display:block;background:#fff}
</style></head>
<body>
<div id="toolbar">
<button onclick="panZoom.zoomIn()">+</button>
<button onclick="panZoom.zoomOut()">-</button>
<button onclick="panZoom.resetZoom();panZoom.center();panZoom.fit()">reset</button>
<span>scroll = zoom &middot; drag = pan</span>
</div>
<div id="stage">''' + svg + '''</div>
<script src="https://cdn.jsdelivr.net/npm/svg-pan-zoom@3.6.1/dist/svg-pan-zoom.min.js"></script>
<script>
const svgEl=document.querySelector('#stage svg');
svgEl.setAttribute('width','100%');svgEl.setAttribute('height','100%');
const panZoom=svgPanZoom(svgEl,{zoomEnabled:true,controlIconsEnabled:false,fit:true,center:true,minZoom:0.2,maxZoom:20,mouseWheelZoomEnabled:true,dblClickZoomEnabled:true});
window.panZoom=panZoom;
window.addEventListener('resize',()=>{panZoom.resize();panZoom.fit();panZoom.center()});
</script></body></html>
'''
pathlib.Path(html_path).write_text(html)
print('wrote', len(html), 'bytes to', html_path)
