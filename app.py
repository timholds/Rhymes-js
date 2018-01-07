#----------------------------------------------------------------------------#
# Imports
#----------------------------------------------------------------------------#

from flask import Flask, render_template, request, send_file
#import flask_restful
from flask import Response
from flask_restful import Api, Resource
import logging
from logging import Formatter, FileHandler
from forms import *
import os
# from flask.ext.sqlalchemy import SQLAlchemy

#----------------------------------------------------------------------------#
# App Config.
#----------------------------------------------------------------------------#

app = Flask(__name__)
app.config.from_object('config')
api = Api(app)
#db = SQLAlchemy(app)

# Automatically tear down SQLAlchemy.
'''
@app.teardown_request
def shutdown_session(exception=None):
    db_session.remove()
'''

# Login required decorator.
'''
def login_required(test):
    @wraps(test)
    def wrap(*args, **kwargs):
        if 'logged_in' in session:
            return test(*args, **kwargs)
        else:
            flash('You need to login first.')
            return redirect(url_for('login'))
    return wrap
'''
#----------------------------------------------------------------------------#
# Controllers.
#----------------------------------------------------------------------------#

@app.route('/')
def home():
    return render_template('layouts/main.html')
    #return render_template('pages/placeholder.home.html')

@app.route('/cmudict.js')
def cmudict():
    try:
        return send_file('/static/cmudict.js')
    except Exception as e:
        return str(e)

@app.route('/data/hamilton.csv')
def hamilton_data():
    try:
        return send_file('/static/data/hamilton.csv')
    except Exception as e:
        return str(e)

@app.route('/data/readyornot.csv')
def readyornot_data():
    try:
        return send_file('/static/data/readyornot.csv')
    except Exception as e:
        return str(e)

@app.route('/data/penzance.csv')
def penzance_data():
    try:
        return send_file('/static/data/penzance.csv')
    except Exception as e:
        return str(e)

@app.route('/data/righthand.csv')
def righthand_data():
    try:
        return send_file('/static/data/righthand.csv')
    except Exception as e:
        return str(e)

@app.route('/data/bigpun.csv')
def bigpun_data():
    try:
        return send_file('/static/data/bigpun.csv')
    except Exception as e:
        return str(e)

@app.route('/data/nonstop.csv')
def nonstop_data():
    try:
        return send_file('/static/data/nonstop.csv')
    except Exception as e:
        return str(e)

@app.route('/data/rakim.csv')
def rakim_data():
    try:
        return send_file('/static/data/rakim.csv')
    except Exception as e:
        return str(e)

@app.route('/data/nas.csv')
def nas_data():
    try:
        return send_file('/static/data/nas.csv')
    except Exception as e:
        return str(e)

@app.route('/data/onyourside.csv')
def onyourside_data():
    try:
        return send_file('/static/data/onyourside.csv')
    except Exception as e:
        return str(e)

@app.route('/data/burrsir.csv')
def burrsir_data():
    try:
        return send_file('/static/data/burrsir.csv')
    except Exception as e:
        return str(e)

@app.route('/data/goodkid.csv')
def goodkid_data():
    try:
        return send_file('/static/data/goodkid.csv')
    except Exception as e:
        return str(e)

@app.route('/data/myshot.csv')
def myshot_data():
    try:
        return send_file('/static/data/myshot.csv')
    except Exception as e:
        return str(e)

@app.route('/about')
def about():
    return render_template('pages/placeholder.about.html')


@app.route('/login')
def login():
    form = LoginForm(request.form)
    return render_template('forms/login.html', form=form)


@app.route('/register')
def register():
    form = RegisterForm(request.form)
    return render_template('forms/register.html', form=form)


@app.route('/forgot')
def forgot():
    form = ForgotForm(request.form)
    return render_template('forms/forgot.html', form=form)

# Error handlers.


@app.errorhandler(500)
def internal_error(error):
    #db_session.rollback()
    return render_template('errors/500.html'), 500


@app.errorhandler(404)
def not_found_error(error):
    return render_template('errors/404.html'), 404

if not app.debug:
    file_handler = FileHandler('error.log')
    file_handler.setFormatter(
        Formatter('%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]')
    )
    app.logger.setLevel(logging.INFO)
    file_handler.setLevel(logging.INFO)
    app.logger.addHandler(file_handler)
    app.logger.info('errors')

#----------------------------------------------------------------------------#
# Launch.
#----------------------------------------------------------------------------#

# Default port:
if __name__ == '__main__':
    app.run(debug=True)

# Or specify port manually:
'''
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
'''

class DataAPI(Resource):
    def get(self, filename):
        pass
api.add_resource(DataAPI, '/data/<str:filename>', endpoint = 'user')