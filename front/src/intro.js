import React from 'react';

class Intro extends React.Component {
    render() {
        return <div className="intro">
            <h1>John Wick Discord Bot</h1>
            <ul className="link-list">
                <li><a href="https://discordapp.com/oauth2/authorize?client_id=436684273131716611&scope=bot">Invite @JohnWick to your server</a></li>
				<li><a href="https://twitter.com/bot_wick">Follow me on Twitter!</a></li>
                <li><a href="https://discord.gg/4FUwt2v">Join our Discord Support Server</a></li>
            </ul>
        </div>;
    }
}

export default Intro;
