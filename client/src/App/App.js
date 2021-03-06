import React, { Component } from 'react';
import { getUser, getTopTracks, getAudioFeatures, getGenres, refreshAuth } from '../apiCalls';
import { tracksByGenre, asyncForEach, cleanUser } from '../utilities';
import '../reset.css';
import './App.css';

import Login from '../Login/Login';
import User from '../User/User';
import TempoGraph from '../Visualizations/TempoGraph';
import ScatterPlot from '../Visualizations/ScatterPlot';

class App extends Component {
  state = {
    loading: false,
    token: '',
    genres: {},
    user: {},
    topTracks: [],
    range: 'short_term',
    graph: 'bar'
  }

  async componentDidMount() {
    let hashes = window.location.hash.substring(1).split('&');
    let params = {}

    hashes.forEach(hash => {
        let [key, val] = hash.split('=')
        params[key] = decodeURIComponent(val)
    })

    let { access_token, refresh_token } = params || '';

    if (access_token) {
      this.setUser(access_token);
      this.setState({
        token: access_token,
        refresh_token,
        loading: true
      })

      this.refreshInterval = setInterval(async () => {
        let response = await refreshAuth(this.state.refresh_token);
        let result = await response.json();
        let token = result.access_token;
        let refresh_token = result.refresh_token;

        this.setState({
          token,
          refresh_token
        })
      }, 30 * 60000)
    }
  }

  async setUser (token) {
    let user;

    try {
      user = await getUser(token);
      user = await cleanUser(user)

    } catch(error) {
      throw(error)
    }

    if (user.display_name) {
      this.setState({ user })
      this.setTopTracks(token); 
    } else {
      this.setState({ token: null})
    }

  }

  async setTopTracks (token, range=this.state.range) {
    try {
      let topTracks = await getTopTracks(token, range);
      topTracks = await this.setTrackDetails(topTracks);

      let interval = setInterval(() => {
        if (topTracks && topTracks[topTracks.length - 1].genres) {     
          this.setState({topTracks});
          // this.setGenres(topTracks);
          window.clearInterval(interval);
          this.setState({ loading: false });
        };
      }, 500)
    } catch(error) {
      console.error(error);
      let response = await refreshAuth(this.state.refresh_token);
      let result = response.json();
      let { token, refresh_token } = result;
        this.setState({
          token,
          refresh_token
        })
      this.setUser(token);
    }
  }

  async setTrackDetails (topTracks) {
    asyncForEach(topTracks, async (track) => {
      let audioFeatures = await getAudioFeatures(this.state.token, track.id);

      Object.assign(track, await audioFeatures);
      let genres = await getGenres(this.state.token, track.artistId);

      track.genres = await genres;
    })
    return topTracks;
  }

  async setGenres (topTracks) {
    let genres = tracksByGenre(topTracks);

    this.setState({genres}); 
  }

  handleRangeChange = (event) => {
    let range = event.target.value;

    this.setState({ 
      range,
      loading: true 
    });
    this.setTopTracks(this.state.token, range)
  }

  changeGraph = (type) => {
    this.setState({
      graph: type
    })
  }

  signOut = () => {
    this.setState({
      token: '',
      user: {}
    })
    clearInterval(this.refreshInterval);
    window.location.href = window.location.href.split("#")[0];
  }

  render() {
    return (
      <div className='app-body'>
        { !this.state.token &&
          <header>
            <h1 className='title'>SeeTune</h1>
            <p className='subtitle'>Interactive graphs for Spotify users to visualize and compare characteristics of their top tracks.</p>
          </header>
        }
        <div className='app'>
          {this.state.user && <User user={this.state.user} signOut={this.signOut} />}
          {!this.state.token && <Login/>}
          { this.state.token && 
            <section className='visualizations'>
              <nav>  
                <div className={`nav-link nav-left ${this.state.graph === 'bar' && 'active'}`}
                  onClick={() => this.changeGraph('bar')}>Bar Chart</div>
                <div className={`nav-link nav-right ${this.state.graph === 'scatter' && 'active'}`}
                  onClick={() => this.changeGraph('scatter')}>Scatter Plot</div>
              </nav>
              <h2 className='brand'>SeeTune</h2>
              <form className='range-form'>
                <label htmlFor='range'>Time Range: </label>
                <select 
                  name='range'
                  value={ this.state.range } 
                  onChange={ this.handleRangeChange }>
                  <option value='short_term'>~1 month</option>
                  <option value='medium_term'>~6 months</option>
                  <option value='long_term'>years</option>
                </select>
              </form>
              { this.state.graph === 'bar' ?
                <TempoGraph 
                  topTracks={ !this.state.loading && this.state.topTracks } 
                  range={ this.state.range }
                  loading={ this.state.loading }/>
                :
                <ScatterPlot
                  topTracks={ !this.state.loading && this.state.topTracks }
                  loading={ this.state.loading }/>
              }      
            </section>
          }
        </div>
        <footer>
          <p>Built with D3.js and powered by the Spotify API</p>
          <p>&copy; dsdunn 2019</p>
        </footer>
        <div className='tool-tip'></div>
      </div>
    );
  }
}

export default App;
