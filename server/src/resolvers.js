const { paginateResults } = require('./utils');
const  LaunchAPI = require('./datasources/launch')

module.exports = {
  Query: {
    launches: async (_, { pageSize = 20, after }, { dataSources }) => {
      const launches = await dataSources.launchAPI.getAllLaunches(
        pageSize,
        after
      );

      return {
        launches,
        cursor: launches.length ? launches[launches.length - 1].cursor : null,
        hasMore: false
      };
    },
    launch: (_, { id }, { DataLoader }) => {
      const res = DataLoader.getLaunchesByIds
        .load(parseInt(id))
        .then(v => v && { ...v, id: v.flight_number });
      return res;
    },
    ship: (_, { id }, { DataLoader }) => {
      return { id };
    },
    me: async (_, __, { dataSources }) =>
      dataSources.userAPI.findOrCreateUser(),
  },
  Mutation: {
    bookTrips: async (_, { launchIds }, { dataSources }) => {
      const results = await dataSources.userAPI.bookTrips({ launchIds });
      const launches = await dataSources.launchAPI.getLaunchesByIds({
        launchIds,
      });

      return {
        success: results && results.length === launchIds.length,
        message:
          results.length === launchIds.length
            ? 'trips booked successfully'
            : `the following launches couldn't be booked: ${launchIds.filter(
                id => !results.includes(id),
              )}`,
        launches,
      };
    },
    cancelTrip: async (_, { launchId }, { dataSources }) => {
      const result = dataSources.userAPI.cancelTrip({ launchId });

      if (!result)
        return {
          success: false,
          message: 'failed to cancel trip',
        };

      const launch = await dataSources.launchAPI.getLaunchById({ launchId });
      return {
        success: true,
        message: 'trip cancelled',
        launches: [launch],
      };
    },
    login: async (_, { email }, { dataSources }) => {
      const user = await dataSources.userAPI.findOrCreateUser({ email });
      if (user) return new Buffer(email).toString('base64');
    },
  },
  Launch: {
    isBooked: async (launch, _, { dataSources }) =>
      dataSources.userAPI.isBookedOnLaunch({ launchId: launch.id }),
      site: async (launch, _, { DataLoader }) =>
      (await DataLoader.getLaunchesByIds.load(launch.id)).launch_site.site_name,
    mission: async (launch, _, { DataLoader }) => {
      const res = await DataLoader.getLaunchesByIds.load(launch.id);
      return {
        name: res.mission_name,
        missionPatchSmall: res.links.mission_patch_small,
        missionPatchLarge: res.links.mission_patch
      };
    },
    rocket: async (launch, _, { DataLoader }) =>
      (await DataLoader.getLaunchesByIds.load(launch.id)).rocket,
    ships: async (launch, _, { DataLoader }) =>
      (await DataLoader.getLaunchesByIds.load(launch.id)).ships.map(ship => ({
        id: ship
      }))
  },
  Rocket: {
    id: rocket => rocket.rocket_id,
    name: rocket => rocket.rocket_name,
    type: rocket => rocket.rocket_type
  },
  Ship: {
    launches: async (ship, _, { DataLoader }) => {
      const ship_res = await DataLoader.getShipById.load(ship.id.toUpperCase());
      if (!ship_res || !ship_res.missions) return [];
      const flights_id = ship_res.missions.map(v => v.flight);
      return flights_id.map(v => ({ id: v }));
      // return DataLoader.getLaunchesByIds
      //   .loadMany(flights_id)
      //   .then(res => res.map(v => v && launchReducer(v)));
    }
  },
  Mission: {
    // make sure the default size is 'large' in case user doesn't specify
    missionPatch: (mission, { size } = { size: 'LARGE' }) => {
      return size === 'SMALL'
        ? mission.missionPatchSmall
        : mission.missionPatchLarge;
    },
  },
  User: {
    trips: async (_, __, { dataSources, DataLoader }) => {
      // get ids of launches by user
      const launchIds = await dataSources.userAPI.getLaunchIdsByUser();

      if (!launchIds.length) return [];

      // look up those launches by their ids
      return (
        DataLoader.getLaunchesByIds
          .loadMany(launchIds)
          .then(res => res.map(v => new LaunchAPI().launchReducer(v))) || []
      );
    },
  },
};
