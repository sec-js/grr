#!/usr/bin/env python
"""Tests for API client and labels-related API calls."""
from __future__ import absolute_import
from __future__ import division
from __future__ import unicode_literals

from absl import app

from grr_response_proto import objects_pb2
from grr_response_server import data_store
from grr_response_server.gui import api_integration_test_lib
from grr.test_lib import test_lib


class ApiClientLibLabelsTest(api_integration_test_lib.ApiIntegrationTest):
  """Tests VFS operations part of GRR Python API client library."""

  def setUp(self):
    super(ApiClientLibLabelsTest, self).setUp()
    self.client_id = self.SetupClient(0)

  def testAddLabels(self):
    client_ref = self.api.Client(client_id=self.client_id)
    self.assertEqual(list(client_ref.Get().data.labels), [])

    with test_lib.FakeTime(42):
      client_ref.AddLabels(["foo", "bar"])

    self.assertEqual(
        sorted(client_ref.Get().data.labels, key=lambda l: l.name), [
            objects_pb2.ClientLabel(name="bar", owner=self.token.username),
            objects_pb2.ClientLabel(name="foo", owner=self.token.username)
        ])

  def testRemoveLabels(self):
    with test_lib.FakeTime(42):
      data_store.REL_DB.AddClientLabels(self.client_id, self.token.username,
                                        ["bar", "foo"])

    client_ref = self.api.Client(client_id=self.client_id)
    self.assertEqual(
        sorted(client_ref.Get().data.labels, key=lambda l: l.name), [
            objects_pb2.ClientLabel(name="bar", owner=self.token.username),
            objects_pb2.ClientLabel(name="foo", owner=self.token.username)
        ])

    client_ref.RemoveLabel("foo")
    self.assertEqual(
        sorted(client_ref.Get().data.labels, key=lambda l: l.name),
        [objects_pb2.ClientLabel(name="bar", owner=self.token.username)])


def main(argv):
  test_lib.main(argv)


if __name__ == "__main__":
  app.run(main)
