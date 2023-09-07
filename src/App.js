import React, { useEffect, useRef, useState } from 'react';
import { initNotifications, notify } from '@mycv/f8-notification';
import {Howl, Howler} from 'howler';
import * as mobilenet from '@tensorflow-models/mobilenet';
import * as knnClassifier from '@tensorflow-models/knn-classifier';
import * as tf from '@tensorflow/tfjs';
import './App.css';
import soundURL from './assets/sound.mp3';

var sound = new Howl({
  src: [soundURL]
});

const NOT_TOUCH_LABEL = 'Not Touch';
const TOUCHED_LABEL = 'Touched';
const TRAINING_TIMES = 50;
const TOUCHED_CONFIDENCES = 0.8;

function App() {
  const video = useRef();
  const classifier = useRef();
  const mobilenetModule = useRef();
  const canPlaySound = useRef(true);
  const [touched, setTouched] = useState(false)

  const init = async () => {
    console.log('Init...')
    await setupCamera();

    console.log('#35217 - Success')
    notify("Don't Touch Your Face Notifications", { body: 'Setup Camera success' });

    mobilenetModule.current = await mobilenet.load();
    classifier.current = knnClassifier.create();

    console.log("#26172 - Success")
    notify("Don't Touch Your Face Notifications", { body: 'Setup Done.' });

    alert("Don't touch your face and press Train Not Touch")
    initNotifications({ cooldown: 3000 });
  }

  const setupCamera = () => {
    return new Promise((resolve, reject) => {
      navigator.getUserMedia = navigator.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia ||
        navigator.msGetUserMedia;

      if (navigator.getUserMedia) {
        navigator.getUserMedia(
          { video: true },
          stream => {
            video.current.srcObject = stream;
            video.current.addEventListener('loadeddata', resolve)
          },
          error => reject(error)
        )
      } else {
        reject()
      }
    })
  }

  const train = async label => {
    console.log(`[${label}] Training...`)
    
    for (let i = 0; i < TRAINING_TIMES; ++i) {
      console.log('#11892 - Waiting...')
      notify("Don't Touch Your Face Notifications", { body: `Progress ${parseInt((i+1) / TRAINING_TIMES * 100)}%` });

      await training(label);
    }

    if (label === TOUCHED_LABEL) {
      console.log('#11892 - Success')
      alert(`Training ${label} complete. Press Run button to try.`)
      notify("Don't Touch Your Face Notifications", { body: `Training ${label} complete. Press Run button to try.` });
    } else {
      console.log('#11892 - Success')
      alert(`Training ${label} complete. Touch your face and press Train Touch`)
      notify("Don't Touch Your Face Notifications", { body: `Training ${label} complete. Touch your face and press Train Touch`})
    }
  }

  const training = label => {
    return new Promise(async resolve => {
      const embedding = mobilenetModule.current.infer(
        video.current,
        true
      );
      classifier.current.addExample(embedding, label)
      await sleep(100);
      resolve();
    });
  }

  const run = async () => {
    const embedding = mobilenetModule.current.infer(
      video.current,
      true
    );
    const result = await classifier.current.predictClass(embedding);

    if (
      result.label === TOUCHED_LABEL &&
      result.confidences[result.label] > TOUCHED_CONFIDENCES
    ) {
       console.log('Touched');
       if (canPlaySound.current) {
        canPlaySound.current = false;
        sound.play();
       }

       notify('Take your hands off!', { body: 'You just touched your face.' });
       setTouched(true)
    } else {
      console.log('Not Touched')
      setTouched(false)
    }

    await sleep(200);

    run()
  }

  const sleep = (ms = 0) => {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  useEffect(() => {
    init();

    sound.on('end', function() {
      canPlaySound.current = true;
    });

    return () => {

    }
  }, []);
  return (
    <div className={`App ${touched ? 'touched' : ''}`}>
      <video
        ref={video}
        className="video"
        autoPlay
      />

      <div id="control">
        <button className="btn-not_touch" onClick={() => train(NOT_TOUCH_LABEL)}>Train Not Touch</button>
        <button className="btn-touched" onClick={() => train(TOUCHED_LABEL)}>Train Touch</button>
        <button className="btn-run" onClick={() => run()}>Run</button>
      </div>
    </div>
  );
}

export default App;
