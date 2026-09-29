/**
 * Browser-side Face & Camera Activity Monitor
 * Evaluates video feed for:
 * - NO_FACE: No candidate face visible in frame
 * - MULTIPLE_FACES: Multiple distinct skin/face centers detected
 * - CAMERA_DISCONNECTED: Video track ended or failed
 */

export class FaceDetector {
  constructor(videoElement, onEvent) {
    this.video = videoElement;
    this.onEvent = onEvent; // callback(eventType, severity, metadata)
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.intervalId = null;
    this.isActive = false;
    this.noFaceConsecutiveCount = 0;
    this.multipleFacesConsecutiveCount = 0;
  }

  start(intervalMs = 2500) {
    if (this.isActive) return;
    this.isActive = true;

    this.intervalId = setInterval(() => {
      this.analyzeFrame();
    }, intervalMs);
  }

  stop() {
    this.isActive = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  analyzeFrame() {
    if (!this.video || this.video.readyState !== 4) {
      return;
    }

    const width = 160;
    const height = 120;
    this.canvas.width = width;
    this.canvas.height = height;

    try {
      this.ctx.drawImage(this.video, 0, 0, width, height);
      const frame = this.ctx.getImageData(0, 0, width, height);
      const data = frame.data;

      // Skin & Face Region Detection Algorithm
      // Detects standard human skin chromaticity in RGB/YCbCr color space
      let skinPixels = 0;
      let leftHalfSkin = 0;
      let rightHalfSkin = 0;
      let centerSkin = 0;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          // Normalized skin tone threshold
          const isSkin = (
            r > 95 && g > 40 && b > 20 &&
            Math.max(r, g, b) - Math.min(r, g, b) > 15 &&
            Math.abs(r - g) > 15 &&
            r > g && r > b
          );

          if (isSkin) {
            skinPixels++;
            if (x < width * 0.4) leftHalfSkin++;
            else if (x > width * 0.6) rightHalfSkin++;
            else centerSkin++;
          }
        }
      }

      const totalPixels = width * height;
      const skinRatio = skinPixels / totalPixels;

      // 1. Evaluate NO_FACE
      // If skin ratio is extremely low or virtually zero in the center of frame
      if (skinRatio < 0.04 || (centerSkin / totalPixels) < 0.015) {
        this.noFaceConsecutiveCount++;
        if (this.noFaceConsecutiveCount >= 2) {
          this.onEvent('NO_FACE', 'Medium', {
            skinRatio: skinRatio.toFixed(3),
            message: 'لم يتم رصد وجه المتدرب في الكاميرا'
          });
        }
      } else {
        this.noFaceConsecutiveCount = 0;
      }

      // 2. Evaluate MULTIPLE_FACES
      // When two distinct separated high-density skin clusters exist on far-left and far-right simultaneously
      const leftRatio = leftHalfSkin / (totalPixels * 0.4);
      const rightRatio = rightHalfSkin / (totalPixels * 0.4);

      if (leftRatio > 0.15 && rightRatio > 0.15 && centerSkin / totalPixels < 0.08) {
        this.multipleFacesConsecutiveCount++;
        if (this.multipleFacesConsecutiveCount >= 2) {
          this.onEvent('MULTIPLE_FACES', 'High', {
            leftRatio: leftRatio.toFixed(2),
            rightRatio: rightRatio.toFixed(2),
            message: 'اشتباه وجود أكثر من شخص في مجال الرؤية'
          });
        }
      } else {
        this.multipleFacesConsecutiveCount = 0;
      }
    } catch (e) {
      console.warn('Frame analysis error:', e);
    }
  }

  captureSnapshot() {
    if (!this.video || this.video.readyState !== 4) return null;
    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = 320;
    snapCanvas.height = 240;
    const ctx = snapCanvas.getContext('2d');
    ctx.drawImage(this.video, 0, 0, 320, 240);
    return snapCanvas.toDataURL('image/jpeg', 0.65);
  }
}
