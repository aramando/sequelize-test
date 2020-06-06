module.exports = {
  database: 'sequelize_test',
  username: '',
  password: '',
  sequelize: {
    dialect: 'sqlite', 
    storage: `${__dirname}/data.db`,
    logging: true,
    define: {
      paranoid: true,
      timestamps: true,
      underscoredAll: true        
    }
  },
}
