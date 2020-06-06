const DataTypes = require('sequelize').DataTypes

module.exports = (sequelize) => {
  
  const Tag = sequelize.define('Tag', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    allowImages: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    allowedAlbumsTypes: DataTypes.STRING, // NULL, album types (comma-separated) or 'any'
    order: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    isFilterOpen: { 
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    isEditorOpen: { 
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  })

  Tag.associate = function(models) {
    Tag.hasMany(Tag, { as: 'children', foreignKey: 'parentId' });
    Tag.belongsTo(Tag, { as: 'parent', sourceKey: 'parentId' });
    Tag.belongsToMany(models.Album, { through: 'Albums_Tags' });
  }

  return Tag
}
