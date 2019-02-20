import React from 'react';
import { Container } from 'samsio';
import AssetStore from './assets';
import Carousel from 'nuka-carousel';

class StoreItem extends React.Component {
    render() {
        let mainItem = this.props.item.itemGrants[0];
        if (!mainItem) return null;
        let displayImage = (this.props.item.displayAsset && mainItem.type == 'AthenaCharacter') ? this.props.item.displayAsset.image : mainItem.item.image;
        return <div className={this.props.shopType + "-item " + mainItem.item.rarity}>
            <img className={this.props.shopType + "-image"} src={"/textures/" + displayImage} />
            <div className="title">{mainItem.item.name}</div>
            <div className="price">{this.props.item.price}</div>
        </div>;
    }
}

class FeaturedPanel extends React.Component {
    render() {
        return <div className="featured-panel">
            <Carousel autoplay withoutControls wrapAround>
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
        return <div className="featured-store">{Object.keys(panels).map(v => <FeaturedPanel item={panels[v]} key={v} />)}</div>;
    }
}

class DailyStore extends React.Component {
    render() {
        if (!this.props.daily) return null;
        return <div className="daily-store">
            {this.props.daily.map((v, idx) => <StoreItem item={v} key={idx} shopType="daily" />)}
        </div>;
    }
}

class Stores extends React.Component {
    render() {
        return <div className="store">
            <Container store={AssetStore}>
                <FeaturedStore />
                <DailyStore />
            </Container>
        </div>;
    }
}

export default Stores;
