/* Keeping the phone awake (spec: "Keeping the phone awake"). There is no wake-lock API over plain http, so while a game runs the page plays
   a tiny muted looping video (the known workaround on iPhone and Android), and asks for fullscreen where the phone allows it.
   Both must start from a tap, so this is called from the "I'm ready" button. Nothing here may throw: a phone that refuses just sleeps. */
const WEBM = 'data:video/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYECGFOAZwEAAAAAAAI/EU2bdLpNu4tTq4QVSalmU6yBoU27i1OrhBZUrmtTrIHYTbuMU6uEElTDZ1OsggEeTbuMU6uEHFO7a1OsggIp7AEAAAAAAABZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVSalmsirXsYMPQkBNgI1MYXZmNjAuMTYuMTAwV0GNTGF2ZjYwLjE2LjEwMESJiECPQAAAAAAAFlSua8GuAQAAAAAAADjXgQFzxYhscbToXpkLD5yBACK1nIN1bmSIgQCGhVZfVlA4g4EBI+ODhAvrwgDgibCBELqBEJqBAhJUw2f8c3OgY8CAZ8iaRaOHRU5DT0RFUkSHjUxhdmY2MC4xNi4xMDBzc9ZjwItjxYhscbToXpkLD2fIoUWjh0VOQ09ERVJEh5RMYXZjNjAuMzEuMTAyIGxpYnZweGfIoUWjiERVUkFUSU9ORIeTMDA6MDA6MDEuMDAwMDAwMDAwAB9DtnVAhOeBAKOjgQAAgBACAJ0BKhAAEAAARwiFhYiFhIgCAgAMDWAA/v+rUICjlYEAyACxAQADEGAAGAAYWC/0AAgAAKOVgQGQALEBAAMQNAAYABhYL/QACAAAo5WBAlgAsQEAAxAsABgAGFgv9AAIAACjlYEDIACxAQADECQAGAAYWC/0AAgAABxTu2uRu4+zgQC3iveBAfGCAZ/wgQM=';
const MP4 = 'data:video/mp4;base64,AAAAJGZ0eXBpc29tAAACAGlzb21pc282aXNvMmF2YzFtcDQxAAAC521vb3YAAABsbXZoZAAAAAAAAAAAAAAAAAAAA+gAAAAAAAEAAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAHpdHJhawAAAFx0a2hkAAAAAwAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAQAAAAEAAAAAABhW1kaWEAAAAgbWRoZAAAAAAAAAAAAAAAAAAAKAAAAAAAVcQAAAAAAC1oZGxyAAAAAAAAAAB2aWRlAAAAAAAAAAAAAAAAVmlkZW9IYW5kbGVyAAAAATBtaW5mAAAAFHZtaGQAAAABAAAAAAAAAAAAAAAkZGluZgAAABxkcmVmAAAAAAAAAAEAAAAMdXJsIAAAAAEAAADwc3RibAAAAKRzdHNkAAAAAAAAAAEAAACUYXZjMQAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAQABAASAAAAEgAAAAAAAAAARVMYXZjNjAuMzEuMTAyIGxpYngyNjQAAAAAAAAAAAAAABj//wAAAC5hdmNDAULACv/hABZnQsAK2R7ARAAAAwAEAAADACg8SJkgAQAFaMuDyyAAAAAQcGFzcAAAAAEAAAABAAAAEHN0dHMAAAAAAAAAAAAAABBzdHNjAAAAAAAAAAAAAAAUc3RzegAAAAAAAAAAAAAAAAAAABBzdGNvAAAAAAAAAAAAAAAobXZleAAAACB0cmV4AAAAAAAAAAEAAAABAAAAAAAAAAAAAAAAAAAAYnVkdGEAAABabWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAbWRpcmFwcGwAAAAAAAAAAAAAAAAtaWxzdAAAACWpdG9vAAAAHWRhdGEAAAABAAAAAExhdmY2MC4xNi4xMDAAAACEbW9vZgAAABBtZmhkAAAAAAAAAAEAAABsdHJhZgAAACR0ZmhkAAAAOQAAAAEAAAAAAAADCwAACAAAAAKDAQEAAAAAABR0ZmR0AQAAAAAAAAAAAAAAAAAALHRydW4AAAIFAAAABQAAAIwCAAAAAAACgwAAAAoAAAAKAAAACQAAAAkAAAKxbWRhdAAAAnAGBf//bNxF6b3m2Ui3lizYINkj7u94MjY0IC0gY29yZSAxNjQgcjMxMDggMzFlMTlmOSAtIEguMjY0L01QRUctNCBBVkMgY29kZWMgLSBDb3B5bGVmdCAyMDAzLTIwMjMgLSBodHRwOi8vd3d3LnZpZGVvbGFuLm9yZy94MjY0Lmh0bWwgLSBvcHRpb25zOiBjYWJhYz0wIHJlZj0zIGRlYmxvY2s9MTowOjAgYW5hbHlzZT0weDE6MHgxMTEgbWU9aGV4IHN1Ym1lPTcgcHN5PTEgcHN5X3JkPTEuMDA6MC4wMCBtaXhlZF9yZWY9MSBtZV9yYW5nZT0xNiBjaHJvbWFfbWU9MSB0cmVsbGlzPTEgOHg4ZGN0PTAgY3FtPTAgZGVhZHpvbmU9MjEsMTEgZmFzdF9wc2tpcD0xIGNocm9tYV9xcF9vZmZzZXQ9LTIgdGhyZWFkcz0xIGxvb2thaGVhZF90aHJlYWRzPTEgc2xpY2VkX3RocmVhZHM9MCBucj0wIGRlY2ltYXRlPTEgaW50ZXJsYWNlZD0wIGJsdXJheV9jb21wYXQ9MCBjb25zdHJhaW5lZF9pbnRyYT0wIGJmcmFtZXM9MCB3ZWlnaHRwPTAga2V5aW50PTI1MCBrZXlpbnRfbWluPTUgc2NlbmVjdXQ9NDAgaW50cmFfcmVmcmVzaD0wIHJjX2xvb2thaGVhZD00MCByYz1jcmYgbWJ0cmVlPTEgY3JmPTIzLjAgcWNvbXA9MC42MCBxcG1pbj0wIHFwbWF4PTY5IHFwc3RlcD00IGlwX3JhdGlvPTEuNDAgYXE9MToxLjAwAIAAAAALZYiEBHyYoAA2I4AAAAAGQZo4CPqAAAAABkGaVAI+oAAAAAVBmmAQ9QAAAAVBmoA/1AAAAENtZnJhAAAAK3RmcmEBAAAAAAAAAQAAAAAAAAABAAAAAAAAAAAAAAAAAAADCwEBAQAAABBtZnJvAAAAAAAAAEM=';

let video = null;

/* the tap on "I'm ready": fullscreen where allowed, and the muted looping video. Returns what it managed, for the tests. */
export function keepAwake(doc = document) {
  const done = { fullscreen: false, video: false };
  try {
    const el = doc.documentElement, req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (req) { const p = req.call(el, { navigationUI: 'hide' }); if (p && p.catch) p.catch(() => {}); done.fullscreen = true; }
  } catch { /* iPhone and some browsers say no: fine */ }
  try {
    if (!video) {
      video = doc.createElement('video');
      video.muted = true; video.defaultMuted = true; video.loop = true; video.playsInline = true; video.setAttribute('playsinline', ''); video.setAttribute('muted', '');
      video.setAttribute('aria-hidden', 'true'); video.tabIndex = -1;
      video.style.cssText = 'position:fixed;left:0;bottom:0;width:2px;height:2px;opacity:.02;pointer-events:none;';
      video.src = video.canPlayType('video/webm; codecs="vp8"') ? WEBM : MP4;
      doc.body.appendChild(video);
    }
    const p = video.play(); if (p && p.catch) p.catch(() => {});
    done.video = true;
  } catch { /* a phone that refuses just sleeps */ }
  return done;
}
export function stopAwake() { try { if (video) { video.pause(); video.remove(); video = null; } } catch { /* nothing */ } }
