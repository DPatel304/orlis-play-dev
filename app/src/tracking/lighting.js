/* How bright the room looks to the camera. Pure functions over a plain frame ({ data: RGBA bytes, width, height }, which is what the tracker's
   small copy of the picture is - see pose.js `_grab`; tests build frames in memory). Only numbers come out: the picture is not kept.
     meanLuminance(frame)   0 (black) to 1 (white): the average brightness of the whole picture                                         */
export function meanLuminance(frame, stride = 1){
  if (!frame || !frame.data || !frame.width || !frame.height) return null;
  const { data, width, height } = frame;
  let sum = 0, n = 0;
  for (let y = 0; y < height; y += stride) for (let x = 0; x < width; x += stride){
    const o = (y * width + x) * 4;
    sum += 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]; n++;
  }
  return n ? sum / n / 255 : null;
}
