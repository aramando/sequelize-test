const Path = require('path');
const { DataTypes, Op } = require('sequelize');
const { readdir, rename, stat, rmdir } = require('fs').promises;


const config = require('../config');

const imagePattern = /\.(jpg|jpeg|bmp|png|gif|tif|tiff)$/i;
const excludePattern = /^(__|folder)/;

let Image, AlbumType, albumTypes;

const getAlbumTypes = async () => {
  if (!albumTypes) {
    albumTypes = await AlbumType.unscoped().findAll().then(types => albumTypes = types);
  }
  return albumTypes;
}

// convert all slashes to forward and strip trailing
const normalisePath = path => path.replace(/\\/g, '/').replace(/^(.*?)\/?$/, '$1');

// parse an inclusive album path into location and name (dirname and basename)
function parsePath (path) {
  if (Path.isAbsolute(path)) {
    path = Path.relative(config.imagesPath, path);
  }
  let { dir: location, name } = Path.parse(normalisePath(path));
  if (location === '.') location = '';
  // console.log(`*** Parsed ${path} to { location: '${location}', name: '${name}' }`);
  return { location, name };
}

module.exports = (sequelize) => {
  const Album = sequelize.define('Album', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    displayName: {
      type: DataTypes.STRING,
      allowNull: false
    },
  	location: {
      type: DataTypes.STRING,
      allowNull: false,
      set (location) {
        this.setDataValue('location', location.replace(/\\/g, '/'))
      }
    },
  	rating: {
      type: DataTypes.INTEGER,
      validate: { min: 1, max: 5 } // TODO: check this works for numbers
    },
    url: DataTypes.STRING,
    metadata: DataTypes.JSON,
    modifiedAt: DataTypes.DATE, // updatedAt cannot be set arbitrarily
    path: {
      type: DataTypes.VIRTUAL,
      get () {
        if (this.location === undefined || this.name === undefined) {
          return null;
        }
        return Path.posix.join(this.location, this.name);
      },
      set (path) {
        let { dir, name } = Path.parse(path);
        this.setDataValue('name', name);
        this.setDataValue('location', dir === '.' ? '' : dir.replace(/\\/g, '/'));
      }
    }
  }, {
    // collate: 'nocase',
    indexes: [
      { fields: [{ attribute: 'name', collate: 'nocase' }] },
      { fields: [{ attribute: 'location', collate: 'nocase' }] },
      {
        fields: ['name', 'location'],
        unique: true
      }
    ],
    hooks: {      
      beforeBulkCreate: albums => {
        albums.forEach(a => {
          if (!a.displayName) { 
            a.location = normalisePath(a.location);
          }
        });
      },
      beforeValidate: album => {
        // console.log(`*** beforeValidate: ${album.name} (${typeof album.name})}`)
        if (typeof album.name === 'string') {          
          album.displayName = album.name.replace(/^_(.*)$/, '$1'); // auto-generate from name
          // console.log(`*** auto-set album#displayName to ${album.displayName}`)
        }
      },
      beforeCreate: album => {
        if (!album.displayName) {
          album.location = normalisePath(album.location);
        }
      },
      beforeUpdate: album => {
        if (!album.displayName) {
          album.location = normalisePath(album.location);
        }
      },
      beforeUpdate: async album => {
        // replicate renames and moves in filesystem
        if (album.changed('parentId') || album.changed('name') || album.changed('location')) {
          if (album.changed('parentId')) {
            const parent = await album.getParent();
            if (!parent) throw new Error(`Cannot get parent album`);
            const location = Path.posix.join(parent.location || '', parent.name);
            if (album.location !== location) {
              if (album.changed('location')) 
                throw new Error(`Album's new location does not match path of new parent`);
              album.location = location;
            }
          } else if (album.changed('location')) {
            const parent = await Album.findOne({
              where: { 
                location: Path.dirname(album.location),
                name: Path.basename(album.location) 
              }
            });
            album.parentId = parent.id;
          }
          const to = Path.join(config.imagesPath, album.location, album.name);
          try {
            await stat(to);
          } catch (error) {
            if (error.code !== 'ENOENT') throw error;
            const from = Path.join(
              config.imagesPath, 
              album._previousDataValues.location, 
              album._previousDataValues.name
            );
            return rename(from, to);
          }
          throw new Error("Destination file exists");
        }
      },
      beforeDestroy: async album => {
        const path = Path.join(config.imagesPath, album.location, album.name);
        await rmdir(path);
      }
    },
    getterMethods: {},
    setterMethods: {},
    scopes: {
      minimal: {
        attributes: ['id', 'displayName']
      },
      breadcrumb: {
        attributes: ['id', 'location', 'displayName'],
        order: ['location']
      }
    }
  });
  
  Album.initialise = models => {     
    ({ AlbumType, Image } = models);

    Album.addScope('defaultScope', {
      attributes: ['id', 'path', 'name', 'displayName', 'location', 'rating', 'modifiedAt', 'parentId', 'typeId'],
      include: [
        {
          model: AlbumType,
          as: 'type',
          attributes: ['id', 'name', 'container']
        },
        {
          model: models.Tag,
          as: 'tags',
          attributes: ['id'],
          through: { attributes: [] }
        }
      ]
    });
    
    Album.addScope('basic', {
      attributes: ['id', 'name', 'displayName', 'location', 'rating', 'modifiedAt', 'parentId'],
      order: ['name'],
      include: [
        {
          model: AlbumType,
          as: 'type'
        },       
        {
          model: models.Tag,
          as: 'tags'
        }
      ]
    });
    
    // include immediate contents,
    Album.addScope('contents', {
      include: [
        {
          model: Image,
          as: 'images'
        },  
        { 
          model: Album,
          as: 'albums'
        }
      ]
    });
    
    // include ancestors, prev/next
    Album.addScope('context', {
      include: [
        {
          model: Album.unscoped(),
          as: 'siblings',
          attributes: ['id']
        }      
      ]
    });
    
    // include related and auxiliary content
    Album.addScope('related', {
      include: [
        {
          model: Album,
          as: 'relatedAlbums'
        },
        {
          model: Image,
          as: 'otherImages'
        }
      ]
    });
  };
  
  Album.associate = (models) => {
    Album.hasMany(Album, { as: 'albums', foreignKey: 'parentId' });
    Album.belongsTo(Album, { as: 'parent', sourceKey: 'parentId' });
    Album.hasMany(Album, { as: 'siblings', sourceKey: 'parentId', foreignKey: 'parentId' });
    Album.belongsToMany(Album, { 
      as: 'relatedAlbums', 
      through: models.RelatedAlbum, 
      foreignKey: 'sourceId', 
      otherKey: 'albumId' 
    });
    Album.belongsTo(models.AlbumType, { 
      as: 'type', 
      sourceKey: 'typeId'
    })
    Album.hasMany(models.Image, { as: 'images', foreignKey: 'albumId' });
    Album.belongsToMany(models.Image, { as: 'otherImages', through: 'Albums_Images' });    
    Album.belongsToMany(models.Tag, { as: 'tags', through: 'Albums_Tags' });
  };

  // add new albums to db and return them
  Album.syncRoot = async () => {
    // TODO: detect changed albums
    let rootFiles = await readdir(config.imagesPath);
    const albums = await Promise.all(
      rootFiles.map(async file => {
        let album = null;
        try {
          album = await Album.createFromPath(file);
        } catch (e) {}
        return album;
      })
    );
    return { 
      albums: { added: albums.filter(Boolean) } 
    };
  };

  // add new albums and images to db and return them
  Album.syncWithDisk = async albumPath => {
    const where = parsePath(albumPath);   
    let album = await Album.findOne({ where });
    if (!album) {
      album = await Album.createFromPath(albumPath);
    }
    return album.syncWithDisk();
  };

  Album.createFromPath = async (albumPath, parentId) => {
    const stats = await stat(Path.resolve(config.imagesPath, albumPath));
    if (!stats.isDirectory()) {
      return null;
    }
    const { location, name } = parsePath(albumPath);
    if (excludePattern.test(name)) return null;
    const data = {
      name,
      location,
      createdAt: new Date(stats.birthtime || stats.ctime),
      modifiedAt: new Date(stats.mtime)
    };
    parentId && (data.parentId = parentId);
    let album;
    try {
      album = await Album.create(data);
    } catch (error) {
      if (error.name !== 'SequelizeUniqueConstraintError') {
        throw error;
      }
      const deletedAlbum = await Album.findOne({
        where: { name, location: location || '', deletedAt: { [Op.ne]: null } },
        paranoid: false
      });
      if (!deletedAlbum) throw error;
      await deletedAlbum.restore();
      album = deletedAlbum;
    }
    const type = (await getAlbumTypes()).find(t => new RegExp(t.pathMatch).test(album.path));
    if (!type) {
      throw new Error(`Could not determine Type of album ${album.name}`)
    }
    await album.setType(type);
    return Album.findByPk(album.id);
  };

  Album.prototype.updateFromPath = async function () {
    const stats = await stat(Path.join(config.imagesPath, this.location, this.name));
    return this.updateFromStats(stats);
  };

  Album.prototype.updateFromStats = async function (stats) {
    this.set({
      createdAt: new Date(stats.birthtime), // no reason for this to change, but just in case...
      modifiedAt: new Date(stats.mtime)
    });
    const changed = this.changed().length > 0;
    await this.save();
    return changed;
  };

  // add new albums and images to disk and return them
  Album.prototype.syncWithDisk = async function () {
    let albums = await this.getAlbums();
    let images = await this.getImages();
    const results = {
      albums: {
        added: [],
        updated: []
      },       
      images: {
        added: [],
        updated: []
      }
    }
    let files;
    try {
      files = await readdir(Path.join(config.imagesPath, this.location, this.name));      
    }
    catch (err) {
      console.error(err);
      const error = new Error('Album does not exist on disk');
      error.name = 'ALBUM_NOT_FOUND_ON_DISK';
      throw error;
    }

    for (let file of files) {
      const objectPath = Path.join(config.imagesPath, this.location, this.name, file);
      try {
        const stats = await stat(objectPath);
        if (excludePattern.test(file)) { // disallowed file
          continue;
        }
        if (stats.isDirectory()) { // album
          const existingAlbum = albums.find(a => a.name === file);
          if (existingAlbum) {
            albums.splice(albums.indexOf(existingAlbum), 1);  
            if (await existingAlbum.updateFromStats(stats)) {
              results.albums.updated.push(existingAlbum.id);
            }
          } else {
            const newAlbum = await Album.createFromPath(objectPath, this.id);
            await this.addAlbum(newAlbum);
            results.albums.added.push(await Album.findByPk(newAlbum.id));
          }
        } else if (imagePattern.test(file)) { // image
          const existingImage = images.find(i => i.filename === file);
          if (existingImage) {
            images.splice(images.indexOf(existingImage), 1);
            if (await existingImage.updateFromPath(objectPath)) {
              results.images.updated.push(existingImage.id);
            }
          } else {            
            const newImage = await Image.createFromPath(objectPath, this.id);
            await this.addImage(newImage);
            results.images.added.push(await Image.findByPk(newImage.id));
          }
        }
      } catch (error) {
        console.error(`Error creating ${file}: ${error.message}`);
        console.error(error);
      }
    }    

    // remaining items in collections are no longer on disk, so destroy
    for (let album of albums) {
      await album.destroy();
    }
    for (let image of images) {
      await image.destroy();
    }

    return {
      albums: {
        ...results.albums,
        removed: albums.map(a => a.id)
      },
      images: {
        ...results.images,
        removed: images.map(a => a.id)
      }
    };
  };

  Album.prototype.getAncestors = async function () {
    if (this.location === undefined) {
      throw new Error('Album#getAncestors() requires the location field to be loaded with the album instance');
    }
    const where = {
      [Op.or]: 
        this.location.replace(/^\/?(.*)/, '$1').split('/').map((name, i, segs) => ({
          location: segs.slice(0, i).join('/'),   
          name 
        }))
    };
    return Album.scope('breadcrumb').findAll({ where });
  };


  return Album;

};
