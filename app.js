const bodyParser = require('body-parser');
const Sequelize = require('sequelize');

const { DataTypes } = Sequelize;

const sequelize = new Sequelize(
  'sequelize_test', 
  '', 
  '', 
  {
    dialect: 'sqlite', 
    storage: `${__dirname}/data.db`,
    logging: true
  }
);

const Image = sequelize.define('Image', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  filename: {
    type: DataTypes.STRING,
    allowNull: false,
  }
})

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
});

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
})

Image.belongsTo(Album, { as: 'album', foreignKey: 'albumId' });
Image.hasMany(Tag, { as: 'tags' });

sequelize
  .sync({ force: process.argv.includes('--init-db') })
  .then(async () => {
    const images = await Image.findAll({
      include: [
        {
          model: Album,
          as: 'album',
          where: { name: '' }, // BREAKING
        },
        // BREAKING:
        {
          model: Tag,
          as: 'tags',
        }
      ],
      limit: 50, // BREAKING
      order: [ 
        ['album', 'name', 'ASC'] // BREAKING  
      ]
    }); 
    console.log(images);
  })
  .catch(error => console.log(error))
