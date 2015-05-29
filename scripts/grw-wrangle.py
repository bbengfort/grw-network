#!/usr/bin/env python
# grw-wrangle
# Takes the CSV file from Google Drive and creates the required JSON data.
#
# Author:   Benjamin Bengfort <benjamin@bengfort.com>
# Created:  Fri May 29 15:28:50 2015 -0400
#
# Copyright (C) 2015 Bengfort.com
# For license information, see LICENSE.txt
#
# ID: grw-wrangle.py [] benjamin@bengfort.com $

"""
Takes the CSV file from Google Drive and creates the required JSON data.
"""

##########################################################################
## Imports
##########################################################################

import os
import re
import json

import unicodecsv as csv

from operator import itemgetter
from unicodedata import normalize
from collections import defaultdict
from itertools import groupby, combinations

##########################################################################
## Important Paths
##########################################################################

PROJECT  = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
FIXTURES = os.path.join(PROJECT, "fixtures")
APPDIR   = os.path.join(PROJECT, "app", "data")

##########################################################################
## Helper Functions
##########################################################################

_punct_re = re.compile(r'[\t !"#$%&\'()*\-/<=>?@\[\\\]^_`{|},.]+')

def slugify(text, delim=u'_'):
    """
    Returns a URL safe slug of the given text.
    """
    result = []
    for word in _punct_re.split(text):
        word = normalize('NFKD', word).encode('ascii', 'ignore')
        if word:
            result.append(word)
    return unicode(delim.join(result))


def dotify(parts, delim=u'.'):
    return delim.join(slugify(p) for p in parts)


def read_csv(path, key=None, delimiter=","):
    path = os.path.join(FIXTURES, path)
    with open(path, 'r') as f:
        reader = csv.DictReader(f, delimiter=delimiter)

        if key is not None:
            reader = sorted([row for row in reader], key=itemgetter(key))

        for row in reader:
            yield row


##########################################################################
## Graph Constructors
##########################################################################

def graph_people(path="people.csv"):
    """
    Spit out connections between people by University and also produce
    the root identifiers for individual people.
    """
    data = defaultdict(dict)
    jkey = u'Institution'

    for row in read_csv(path, key=jkey):

        uid = dotify([u'root', row[u'Institution'], row[u'Name']])

        data[uid] = {
            'name': uid,
            'imports': [],
        }

    return data


def graph_papers(path="papers.csv"):
    """
    Spit out the connections between people by papers
    """
    data = defaultdict(dict)
    jkey = u'Paper'

    for gkey, group in groupby(read_csv(path, key=jkey), itemgetter(jkey)):

        for pair in combinations(group, 2):

            for idx,row in enumerate(pair):
                uid = dotify([row[u'Name']])
                if uid not in data:
                    data[uid] = {
                        'name': uid,
                        'imports': [],
                    }

                cpart = pair[0] if idx == 1 else pair[1]
                data[uid]['imports'].append(dotify([cpart[u'Name']]))

    return data


def create_graph():
    """
    Does the work with defaults
    """
    papers = graph_papers()
    people = graph_people()

    lookup = dict((p.split(".")[-1], p) for p in people.keys())

    for paper in papers.values():
        name = lookup[paper["name"]]
        people[name]["imports"] = list(lookup[name] for name in paper["imports"])

    for people in people.values():
        yield people

##########################################################################
## Main Method
##########################################################################

if __name__ == '__main__':
    print ("Looks for CSV files in %s, and dumps the data into %s"
                % (FIXTURES, APPDIR))

    with open(os.path.join(APPDIR, "grw-papers.json"), 'w') as f:
        json.dump(list(create_graph()), f, indent=2)
