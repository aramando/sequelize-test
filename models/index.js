const Sequelize = require('sequelize')
const config = require('../config.js')
const Album = require('./album.model');
const Image = require('./image.model');
const Tag = require('./tag.model');
const AlbumType = require('./albumType.model');
const RelatedAlbum = require('./relatedAlbum.model');

const sequelize = new Sequelize(
  config.database, 
  config.username, 
  config.password, 
  config.sequelize
)

const db = {
  sequelize,
  AlbumType: AlbumType(sequelize),
  Album: Album(sequelize),
  Image: Image(sequelize),
  Tag: Tag(sequelize),
  RelatedAlbum: RelatedAlbum(sequelize),
};

Object.values(db).forEach(model => model.associate && model.associate(db))
Object.values(db).forEach(model => model.initialise && model.initialise(db))

db.onReady = process.env.NODE_ENV === 'test'
  ? Promise.resolve()
  : db.sequelize.sync({ 
    force: process.argv.includes('--init-db')
  });

db.onReady = db.onReady.then(async () => {
  try {
    await Promise.all([
      db.AlbumType.create({ 
        name: 'Container', 
        pluralName: 'Containers',
        pathMatch: '^[^/]+$', 
        container: true 
      }),
      db.AlbumType.create({ 
        name: 'Group', 
        pluralName: 'Groups',
        pathMatch: '^[^/]+\\/_[^/]+$', 
        container: true 
      }),
      db.AlbumType.create({ 
        name: 'Entity', 
        pluralName: 'Entities',
        pathMatch: '^[^/]+\\/(?:_[^/]+\\/)?[^_/][^/]*$', 
        container: false 
      }),
      db.AlbumType.create({ 
        name: 'Set',  
        pluralName: 'Sets',
        pathMatch: '^[^/]+\\/(?:_[^/]+\\/)?[^_/][^/]*\\/[^/]+$', 
        container: false 
      })
    ]);
  } catch (e) {}
});

module.exports = db
