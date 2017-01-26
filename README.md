# prettier-master

A bot that runs Prettier on all JavaScript code that has been changed. This
will inspect the previous commit and run prettier against any updated JavaScript
files. It will then commit the changes to master.

It has been written so that it can be easily used with Travis or Circle CI.

## Installation

You'll need to install both prettier and prettier-master. The easiest set-up is
to install them globally.

`npm install -g prettier prettier-master`

You can alternatively install them however you want, but then your usage will
deviate from below. To use a different location of `prettier` you can use the
environment variable `PRETTIER_CMD` to specify the relative path to the
executable.

## Environment variables

 - PRETTIER_CMD - default: 'prettier'
 - MASTER_BRANCH - default: 'master'

## Usage

You can use prettier-master locally but just running `prettier-master` within
the directory of the repository you want to make *prettier*.

For better effect though this script has really been put together so that you
can add it as part of CI process using either Travis or Circle.

### Travis

Add to your install section:

```
  install:
    - npm install -g prettier
    - npm install -g prettier-master
```

Then add to your script section:

```
  script:
    - prettier-master
```

Push some JavaScript changes to your repo!
