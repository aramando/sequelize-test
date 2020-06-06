const express = require('express');
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

sequelize.sync({ force: process.argv.includes('--init-db') });


const app = express();
const port = 3000;
app.use(bodyParser.json());

app.get('/images', async (req, res) => {
  try {
    const images = await Image.findAll({
      include: [
        {
          model: Album,
          as: 'album',
          where: {} // BREAKING
        },
        // BREAKING:
        {
          model: Tag,
          as: 'tags',
          attributes: ['id'],
        }
      ],
      limit: 50, // BREAKING
      order: [ 
        ['album', 'name', 'ASC'] // BREAKING
      ]
    });
    res.json(images);
  } catch (err) {
    console.log(err)
    res.status(500).send(err.message)
  }
});

app.listen(port, () => {
  console.info(`Server listening on port ${port}`);
});
