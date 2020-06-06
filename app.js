const express = require('express');
const bodyParser = require('body-parser');
const Sequelize = require('sequelize');
const config = require('./config.js');

const { DataTypes } = Sequelize;

const sequelize = new Sequelize(
  config.database, 
  config.username, 
  config.password, 
  config.sequelize
);

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

Image.belongsTo(Album, { as: 'album', foreignKey: 'albumId' });
Image.belongsToMany(Tag, { as: 'tags', through: 'Images_Tags' });
Tag.belongsToMany(Image, { through: 'Images_Tags' });

sequelize.sync({ force: process.argv.includes('--init-db') });


const app = express();
const port = 3000;
app.use(bodyParser.json());

app.get('/images', async (req, res) => {      
  const opts = {
    include: [
      {
        model: Album,
        as: 'album',
        where: {} // BREAKS
      },
      // BREAKS:
      {
        model: Tag,
        as: 'tags',
        attributes: ['id'],
      }
    ],
    limit: 50, // BREAKS
    order: [ 
      ['album', 'name', 'ASC'] // BREAKS
    ]
  };

  try {
    const images = await Image.findAll(opts);
    res.json(images);
  } catch (err) {
    console.log(err)
    res.status(500).send(err.message)
  }
});

app.listen(port, () => {
  console.info(`Server listening on port ${port}`);
});
