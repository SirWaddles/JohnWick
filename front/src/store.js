import React from 'react';
import { Container } from 'samsio';
import AssetStore from './assets';

class StoreItem extends React.Component {
    render() {
        let mainItem = this.props.item.itemGrants[0];
        if (!mainItem) return null;
        let showDisplayAsset = (this.props.item.displayAsset && mainItem.type == 'AthenaCharacter');
        let displayImage = showDisplayAsset ? this.props.item.displayAsset.image : mainItem.item.image;
        let displayName = AssetStore.getState().locales.filter(v => v.key == mainItem.item.name.key).pop();
        if (!displayName) {
            displayName = mainItem.item.name.string;
        } else {
            displayName = displayName.string;
        }
        return <div className={this.props.shopType + "-item " + mainItem.item.rarity}>
            <div className={this.props.shopType + "-image" + (mainItem.type == 'AthenaCharacter' ? " display-asset" : " icon-asset")} style={{backgroundImage: "url('/textures/" + displayImage + "')"}} />
            <div className="title">{displayName}</div>
            <div className="price"><span className="price-text">{this.props.item.price}</span></div>
        </div>;
    }
}

class Carousel extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            activeItem: 0,
        };
    }

    render() {
        if (this.props.children.length === 1) {
            return <div>{this.props.children}</div>;
        }
        let activeItem = this.props.children[this.state.activeItem];
        let nextIndex = this.state.activeItem + 1;
        if (nextIndex >= this.props.children.length) nextIndex = 0;
        let nextItem = this.props.children[nextIndex];

        return <div className="c-container">
            {this.props.children.map((v, idx) => {
                if (v == activeItem) return <div className="c-item c-active" key={idx}>{v}</div>;
                if (v == nextItem) return <div className="c-item c-next" key={idx}>{v}</div>;
                return <div className="c-item c-inactive" key={idx}>{v}</div>;
            })}
        </div>;
    }

    componentDidMount() {
        this.timerId = setInterval(() => this.nextItem(), 3000);
    }

    componentWillUnmount() {
        clearInterval(this.timerId);
    }

    nextItem() {
        let nextIndex = this.state.activeItem + 1;
        if (nextIndex >= this.props.children.length) nextIndex = 0;
        this.setState({
            activeItem: nextIndex,
        });
    }
}

class FeaturedPanel extends React.Component {
    render() {
        return <div className="featured-panel">
            <Carousel>
                {this.props.item.map((v, idx) => <StoreItem item={v} key={idx} shopType="featured" />)}
            </Carousel>
        </div>;
    }
}

class FeaturedStore extends React.Component {
    render() {
        if (!this.props.featured) return null;
        let panels = this.props.featured.reduce((acc, v) => {
            v.categories.forEach(e => {
                if (!acc.hasOwnProperty(e)) acc[e] = [];
                acc[e].push(v);
            });
            return acc;
        }, {});
        //return <div className="featured-store">{Object.keys(panels).map(v => <FeaturedPanel item={panels[v]} key={v} />)}</div>;
        return Object.keys(panels).map(v => <FeaturedPanel item={panels[v]} key={v} />);
    }
}

class VoteStore extends React.Component {
    render() {
        if (!this.props.votes) return null;
        return this.props.votes.map((v, idx) => <StoreItem item={v} key={idx} shopType="votes" />);
    }
}

class DailyStore extends React.Component {
    render() {
        if (!this.props.daily) return null;
        return this.props.daily.map((v, idx) => <StoreItem item={v} key={idx} shopType="daily" />)
    }
}

class Stores extends React.Component {
    render() {
        return <div className="store">
            <Container store={AssetStore}>
                <FeaturedStore />
                <DailyStore />
                <VoteStore />
            </Container>
        </div>;
    }
}

export default Stores;
