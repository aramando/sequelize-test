const DataTypes = require('sequelize').DataTypes
const Path = require('path');
const { access, readFile, rename, stat, unlink } = require('fs').promises;
const crypto = require('crypto');
const { imagesPath } = require('../config');

/**
 * Get an object containing properties of an image file.
 * @param {string} imagePath 
 * @return {object}
 */
async function getImageProps (imagePath) {
  if (!Path.isAbsolute(imagePath)) {
    imagePath = Path.resolve(imagesPath, imagePath);
  }
  const fileData = await readFile(imagePath);
  const stats = await stat(imagePath);
  let metadata = { width: 0, height: 0, format: '' };

  const hash = crypto.createHash('sha256');
  hash.update(fileData);

  return {
    filename: Path.basename(imagePath),
    checksum: hash.digest('hex'),
    format: metadata.format,
    width: metadata.width,
    height: metadata.height,
    resolution: metadata.width * metadata.height,
    filesize: stats.size,
    createdAt: new Date(stats.birthtime),
    modifiedAt: new Date(stats.mtime)
  }
}


module.exports = (sequelize) => {
  const Image = sequelize.define('Image', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
  	filename: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { is: /^.+\.(jpg|jpeg|gif|png|bmp)$/i }
    },
    checksum: DataTypes.STRING,
    format: DataTypes.ENUM('l', 'p'),
  	width: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
  	height: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
  	resolution: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
  	filesize: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
  	rating: {
      type: DataTypes.INTEGER,
      validate: { min: 0, max: 5 }
    },
    ranking: DataTypes.INTEGER, // rank within album
    cropX: DataTypes.INTEGER,
    cropY: DataTypes.INTEGER,
    cropW: DataTypes.INTEGER,
    cropH: DataTypes.INTEGER,
    modifiedAt: DataTypes.DATE
  }, {    
    indexes: [
      {
        fields: ['filename']
      },
      {
        fields: ['albumId', 'filename'],
        unique: true
      }
    ],
    hooks: {
      beforeUpdate: async image => {
        if (image.changed('filename') || image.changed('albumId')) {
          const album = await image.getAlbum();   
          const newPath = Path.join(imagesPath, album.path, image.filename);
          try {
            await access(newPath);
          } catch (error) {
            if (error.code === 'ENOENT') {
              const prevAlbum = image.changed('albumId') 
               ? await sequelize.models.Album.findByPk(image._previousDataValues.albumId)
               : album;
              const oldPath = Path.join(imagesPath, prevAlbum.path, image._previousDataValues.filename);
              return rename(oldPath, newPath);
            }
            throw error;
          } 
          throw new Error("An image already exists with this filename");
        }
      },
      beforeDestroy: async image => {
        const album = await image.getAlbum();        
        await unlink(Path.join(imagesPath, album.path, image.filename));
      }
    }
  })

  Image.associate = function(models) {
    Image.belongsTo(models.Album, { as: 'album', foreignKey: 'albumId' });
    Image.belongsToMany(models.Album, { as: 'otherAlbums', through: 'Albums_Images' });
    Image.belongsToMany(models.Tag, { as: 'tags', through: 'Images_Tags' });
  };

  Image.initialise = function (models) {
    Image.addScope('defaultScope', {
      attributes: [
        'id', 
        'filename', 
        'rating', 
        'width', 
        'height', 
        'resolution', 
        'filesize', 
        'modifiedAt', 
        'albumId', 
        'cropX', 
        'cropY', 
        'cropW', 
        'cropH'
      ],
      include: [
        {
          model: models.Tag,
          as: 'tags',
          attributes: ['id'],
          through: { attributes: [] }
        }
      ]
    });

    Image.addScope('parent', {
      include: [
        {
          model: models.Album.unscoped(),
          as: 'album',
          attributes: ['id', 'name', 'location', 'displayName']
        }
      ]
    });
  };

  /**
   * Create an Image object from a file on disk
   * @param atPath {string} Full path (including filename) of the image file
   * @param [albumId] {number} ID of the parent album
   */
  Image.createFromPath = async (atPath, albumId) => {
    // console.log(`*** Creating image from path ${atPath}`);
    // if (!albumId) {
    //   const albumPath = Path.dirname(atPath);
    //   const album = await models.Album.findOne({
    //     where: {
    //       name: Path.basename(albumPath),
    //       path: Path.dirname(albumPath)
    //     }
    //   });
    //   if (album) {
    //     albumId = album.id;
    //   } else {
    //     throw new Error(`No album found at the given path: ${Path.dirname(atPath)}`);
    //   }
    // }
    const props = await getImageProps(atPath);
    albumId && (props.albumId = albumId);
    try {
      const image = await Image.create(props);
      return image;
    } catch (error) {
      if (error.name !== 'SequelizeUniqueConstraintError') {  
        throw error;
      }     
      const deletedImage = await Image.findOne({ 
        where: {
          filename: props.filename,
          albumId: props.albumId
        },
        paranoid: false
      });
      if (deletedImage) {
        await deletedImage.restore();
        return deletedImage.update(props);
      }        
    }
  };

  /**
   * Update the Image instance based on the file on disk
   */
  Image.prototype.updateFromPath = async function (imagePath) {
    if (!imagePath && (!this.album || !this.album.location || !this.album.name)) {
      throw new Error(`Cannot determine path for image ${this.id}; either supply the path or ensure the instance has its parent album attached`);
    }
    const props = await getImageProps(
      imagePath || 
      Path.join(imagesPath, this.album.location, this.album.name, this.filename)
    );
    const image = await Image.unscoped().findByPk(this.id);      
    await image.set(props);
    const changed = image.changed().length > 0;
    if (changed) {
      await image.save();
      this.reload();
    }    
    return changed;
  };

  return Image;
};
