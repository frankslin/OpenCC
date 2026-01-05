# -*- coding: utf-8 -*-

import codecs
import sys


def sort_items(input_filename, output_filename):
    input_file = codecs.open(input_filename, "r", encoding="utf-8")
    dic = {}

    for line in input_file:
        if len(line) == 0 or line == '\n':
            continue
        try:
            key, value = line.split("\t")
        except ValueError:
            print(line)
        while value[-1] == "\n" or value[-1] == "\r":
            value = value[:-1]
        dic[key] = value

    input_file.close()

    output_file = open(output_filename, "wb")

    for key in sorted(dic.keys()):
        line = key + "\t" + dic[key] + "\n"
        output_file.write(line.encode('utf-8'))

    output_file.close()


def reverse_items(input_filename, output_filename):
    input_file = codecs.open(input_filename, "r", encoding="utf-8")
    dic = {}

    for line in input_file:
        if len(line) == 0:
            continue
        key, value = line.split("\t")
        while value[-1] == "\n" or value[-1] == "\r":
            value = value[:-1]

        value_list = value.split(" ")
        for value in value_list:
            if value in dic:
                dic[value].append(key)
            else:
                dic[value] = [key]

    input_file.close()

    output_file = open(output_filename, "wb")

    for key in sorted(dic.keys()):
        # Prioritize non-identity mappings in reverse dictionary
        # If both identity (key==value) and non-identity mappings exist,
        # put non-identity first for better conversion results
        values = dic[key]
        non_identity = [v for v in values if v != key]
        identity = [v for v in values if v == key]
        ordered_values = non_identity + identity

        line = key + "\t" + " ".join(ordered_values) + "\n"
        output_file.write(line.encode('utf-8'))

    output_file.close()


def find_target_items(input_filename, keyword):
    input_file = codecs.open(input_filename, "r", encoding="utf-8")
    for line in input_file:
        if len(line) == 0:
            continue
        key, value = line.split("\t")
        while value[-1] == "\n" or value[-1] == "\r":
            value = value[:-1]

        value_list = value.split(" ")
        for value in value_list:
            if keyword in value:
                sys.stdout.write(line)

    input_file.close()
