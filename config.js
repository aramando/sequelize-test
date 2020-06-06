module.exports = {
  imagesPath: __dirname,
  database: 'sequelize_test',
  username: '',
  password: '',
  sequelize: {
    dialect: 'sqlite', 
    storage: `${__dirname}/data.db`,
    logging: false,
    define: {
      paranoid: true,
      timestamps: true,
      underscoredAll: true        
    }
  },
}
