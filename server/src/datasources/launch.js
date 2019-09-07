const rp = require("request-promise");
class LaunchAPI {
  constructor() {
    this.baseURL = "https://api.spacexdata.com/v3/";
    // rp.debug = true
    const r = rp.defaults({ baseUrl: this.baseURL, json: true });
    Object.assign(this, r);
  }

  // leaving this inside the class to make the class easier to test
  launchReducer(launch) {
    return {
      id: launch.flight_number || 0,
      cursor: `${launch.launch_date_unix}`,
      site: launch.launch_site && launch.launch_site.site_name,
      ships: launch.ships.map(ship => ({ id: ship })),
      mission: {
        name: launch.mission_name,
        missionPatchSmall: launch.links.mission_patch_small,
        missionPatchLarge: launch.links.mission_patch,
      },
      rocket: {
        id: launch.rocket.rocket_id,
        name: launch.rocket.rocket_name,
        type: launch.rocket.rocket_type,
      },
    };
  }

  async getAllLaunches() {
    const response = await this.get('launches');

    // transform the raw launches to a more friendly
    return Array.isArray(response)
      ? response.map(launch => this.launchReducer(launch)) : [];
  }

  async getLaunchById(launchId) {
    const response = await this.get("launches", {
      qs: { flight_number: launchId }
    });
    return response.length ? response[0] : null;
  }

  async getLaunchesByIds(launchIds) {
    return Promise.all(
      launchIds.map(launchId => this.getLaunchById(launchId)),
    );
  }

  async getShipById(shipId) {
    const response = await this.get("ships", { qs: { ship_id: shipId } });
    return response.map(v => ({ ...v, id: v.ship_id }))[0];
  }

  async getShipsByIds(shipIds) {
    console.info('shipIds: ', shipIds);
    return Promise.all(shipIds.map(shipId => this.getShipById(shipId)));
  }
}

module.exports = LaunchAPI;
