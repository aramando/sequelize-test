const DataTypes = require('sequelize').DataTypes
const Path = require('path');
const fs = require('fs');
const config = require('../config');

const imagePattern = /\.(jpg|jpeg|bmp|png|gif|tif|tiff)$/i;
const excludePattern = /^(__|folder)/;

let Image;


// parse an inclusive album path into location and name (dirname and basename)
function parsePath (path) {
  if (Path.isAbsolute(path)) {
    path = Path.relative(config.imagesPath, path);
  }
  let { dir: location, name } = Path.parse(path);
  if (location === '.') location = '';
  // console.log(`*** Parsed ${path} to { location: '${location}', name: '${name}' }`);
  return { location, name };
}

module.exports = (sequelize) => {
  const AlbumType = sequelize.define('AlbumType', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    pluralName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    container: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    pathMatch: {
      type: DataTypes.STRING,
      allowNull: false
    }
  },
  {
    indexes: [
      {
        fields: ['name'],
        unique: true
      },
      {
        fields: ['pluralName'],
        unique: true
      }
    ],
    defaultScope: {
      attributes: ['id', 'name', 'pluralName', 'container']
    }
  });

  AlbumType.associate = (models) => {
    AlbumType.hasMany(models.Album, { 
      as: 'albums', 
      foreignKey: 'typeId'
    });
  };

  // AlbumType.initialise = models => {};

  return AlbumType;

};
