const Path = require('path');
const { Album, AlbumType, Image, Tag, sequelize } = require(".");
const { Op } = require("sequelize");

const orders = ['ASC', 'DESC'];

/**
 * Convert string Sequelize operator keys of the given object to their Symbol equivalents
 */
const symboliseOperators = obj => {
  if (typeof obj !== 'object') return obj;
  Object.entries(obj).forEach(([key, val]) => {
    if (val && typeof val === 'object') {
      symboliseOperators(val);
    } else if (key.startsWith('$') && Op[key.substr(1)]) {
      obj[Op[key.substr(1)]] = val;
      delete obj[key];
    }
  });
  return obj;
}


/**
 * Convert sort order string to a Sequelize sort option array
 * TODO: needs to work with both albums and images
 */
const getOrder = (sort = '', itemType, findAll) => {
  let order = sort.startsWith('-') ? 1 : 0;
  sort = sort.substr(order);
  order = orders[order];

  // contents
  //   sequelize.literal('Albums.name COLLATE NOCASE'),
  //   [{ model: models.Album, as: 'albums' }, 'name', 'ASC'],
  //   [{ model: models.Image, as: 'images' }, sequelize.literal('filename COLLATE NOCASE')]

  // context
  //   sequelize.literal('Albums.name COLLATE NOCASE'),
  //   [{ model: models.Album, as: 'siblings' }, 'name', 'ASC']

  // related
  //   sequelize.literal('Albums.name COLLATE NOCASE'),
  //   [{ model: models.Album, as: 'relatedAlbums' }, 'location'],
  //   [{ model: models.Album, as: 'relatedAlbums' }, 'name'],
  //   [{ model: models.Image, as: 'otherImages' }, sequelize.literal('filename COLLATE NOCASE')]

  if (sort === 'random') return sequelize.random();
  if (sort === 'date') sort = 'modifiedAt'
  
  if (itemType === 'images') {
    const defaults = findAll 
      ? [
          ['album', 'location'],
          ['album', 'name'],
          ['filename'],
        ]
      : [['filename']];
    if (sort === 'name') return defaults.map(i => ([...i, order]));
    if (sort in Image.rawAttributes) return [[sort, order], ...defaults];
  } else {
    const defaults = findAll
      ? [
          ['parent', 'location'],
          ['parent', 'name'],
          ['name'],
        ]
      : [['name']];
    if (sort === 'name') return defaults.map(i => ([...i, order]));
    if (sort in Album.rawAttributes) return [[sort, order], ...defaults];
  }
};


/**
 * Convert an API request query string to Sequelize query options object
 */
exports.getSearchQueryOpts = async (queryProps, itemType = 'albums', findAll = false) => {  
  const { 
    albumId, 
    albumType,
    sort,
    offset = undefined,
    page = 1, 
    pagesize = 50,
    ...rest
  } = queryProps;

  const include = [];
  const where = {};

  if (itemType === 'albums' && albumType) {
    // include.push({
    //   model: AlbumType,
    //   as: 'type',
    //   where: { id: +albumType }
    // });
    where.typeId = albumType;
  }
  
  if (albumId) {
    const { location, name, path } = { location: '', name: 'album', path: 'album' };
    include.push({
      model: Album.unscoped(),
      as: itemType === 'images' ? 'album' : 'parent',
      attributes: ['id', 'location', 'displayName', 'name'],
      where: {
        [Op.or]: [
          { location, name },
          { location: path },
          { location: { [Op.like]: `${path}/%` } }
        ]
      }
    });    
  } else {
    include.push({
      model: Album.unscoped(),
      as: itemType === 'images' ? 'album' : 'parent',
      attributes: ['id', 'location', 'displayName', 'name'],
    });
  }

  Object.entries(rest).forEach(([key, value]) => {    
    key = decodeURIComponent(key.replace('filters.', ''));
    value = symboliseOperators(JSON.parse(decodeURIComponent(value)));
    where[key] = value;
  });
    
  // TODO: handle tags

  const opts = {
    where,
    include,
    offset: offset !== undefined ? offset : ((+page - 1) * +pagesize),
    limit: +pagesize,
    order: getOrder(sort, itemType, findAll)
  };
  // console.log(`*** Parsed query params:`);
  // console.dir(opts, { depth: 6 });
  return opts;
};
