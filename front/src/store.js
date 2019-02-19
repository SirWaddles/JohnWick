import React from 'react';
import { Container } from 'samsio';
import AssetStore from './assets';

class FeaturedItem extends React.Component {
    render() {
        let mainItem = this.props.item.itemGrants[0];
        if (!mainItem) return null;
        return <div className={"featured-item " + mainItem.rarity}>
            <div className="title">{mainItem.name}</div>
            <div className="price">{this.props.item.price}</div>
        </div>;
    }
}

class FeaturedPanel extends React.Component {
    render() {
        return <div className="featured-panel">
            {this.props.item.map((v, idx) => <FeaturedItem item={v} key={idx} />)}
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
        return Object.keys(panels).map(v => <FeaturedPanel item={panels[v]} key={v} />);
    }
}

class Stores extends React.Component {
    render() {
        return <Container store={AssetStore}>
            <FeaturedStore />
        </Container>;
    }
}

export default Stores;
