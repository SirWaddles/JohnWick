import React from 'react';
import ReactDOM from 'react-dom';
import Stores from './store';
import Intro from './intro';
import './style.css';

import './assets.js';

class AppComponent extends React.Component {
    render() {
        return <div>
            <Intro />
            <Stores />
        </div>;
    }
}

let reactDiv = document.createElement("div");
document.body.appendChild(reactDiv);
ReactDOM.render(<AppComponent />, reactDiv);
