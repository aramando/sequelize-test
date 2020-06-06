const DataTypes = require('sequelize').DataTypes

module.exports = (sequelize) => {
  
  const RelatedAlbum = sequelize.define('RelatedAlbum', {
    relationType: {
      type: DataTypes.ENUM('alias', 'altParent'),
      allowNull: false
    }
  });

  return RelatedAlbum
}
